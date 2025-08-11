import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";
import { Dropbox } from "dropbox";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function App() {
  const { user, login, logout } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState(null);
  
  // Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editAmount, setEditAmount] = useState("");

  // Confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  const ACCESS_TOKEN = process.env.REACT_APP_DROPBOX_ACCESS_TOKEN;
  console.log("Dropbox token (first 10 chars):", ACCESS_TOKEN ? ACCESS_TOKEN.slice(0, 10) + "..." : ACCESS_TOKEN);

  // Fetch transactions for logged-in user
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) {
        setTransactions([]);
        return;
      }
      const q = query(collection(db, "transactions"), where("owner", "==", user.uid));
      const data = await getDocs(q);
      setTransactions(data.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchTransactions();
  }, [user]);

 

// --- Dropbox upload using fetch (no SDK) ---
const uploadToDropbox = async (file) => {
  const ACCESS_TOKEN = process.env.REACT_APP_DROPBOX_ACCESS_TOKEN;
  console.log("DEBUG: uploadToDropbox - token present:", !!ACCESS_TOKEN);

  if (!ACCESS_TOKEN) {
    throw new Error("Dropbox access token not found. Add REACT_APP_DROPBOX_ACCESS_TOKEN to your .env and restart dev server.");
  }

  // sanitize filename to avoid problematic chars in path
  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const path = `/${Date.now()}_${safeName}`;
  console.log("DEBUG: Uploading to Dropbox path:", path, "file:", file);

  // 1) Upload file to content API (body = File works fine in fetch)
  const uploadResp = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "add",
        autorename: true,
        mute: false
      }),
      "Content-Type": "application/octet-stream"
    },
    body: file // pass the File object directly
  });

  const uploadText = await uploadResp.text();
  if (!uploadResp.ok) {
    // try to parse JSON error_summary from Dropbox response
    let errMsg = uploadText;
    try { const js = JSON.parse(uploadText); errMsg = js.error_summary || JSON.stringify(js); } catch(e) {}
    throw new Error(`Dropbox upload failed: ${uploadResp.status} ${errMsg}`);
  }

  let uploadJson;
  try { uploadJson = JSON.parse(uploadText); } catch (e) { uploadJson = null; }
  console.log("DEBUG: upload response:", uploadJson);

  // 2) Create a shared link (if it already exists we'll fallback to list_shared_links)
  const createLinkResp = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ path })
  });

  let linkJson = null;
  if (createLinkResp.ok) {
    linkJson = await createLinkResp.json();
  } else {
    // if link already exists or create fails, try list_shared_links
    const text = await createLinkResp.text();
    console.warn("DEBUG: create_shared_link failed:", createLinkResp.status, text);

    const listResp = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ path, direct_only: true })
    });

    if (listResp.ok) {
      const listJson = await listResp.json();
      // pick first link if present
      linkJson = (listJson.links && listJson.links[0]) ? listJson.links[0] : null;
    } else {
      const listText = await listResp.text();
      console.error("DEBUG: list_shared_links also failed:", listResp.status, listText);
      throw new Error(`Dropbox create/list link failed: create ${createLinkResp.status} / list ${listResp.status}`);
    }
  }

  const url = linkJson?.url || linkJson?.links?.[0]?.url;
  if (!url) throw new Error("Dropbox returned no shared link.");

  // convert to direct download
  return url.replace("?dl=0", "?dl=1");
};

// --- Add transaction using uploadToDropbox ---
const addTransaction = async () => {
  if (!text || !amount) return alert("Please enter both fields");

  try {
    let fileUrl = null;
    if (file) {
      // attempt upload and propagate clear errors
      fileUrl = await uploadToDropbox(file);
      console.log("DEBUG: Received Dropbox fileUrl:", fileUrl);
    }

    const newTransaction = {
      text,
      amount: parseFloat(amount),
      owner: user.uid,
      fileUrl,
    };
    const docRef = await addDoc(collection(db, "transactions"), newTransaction);
    setTransactions([{ id: docRef.id, ...newTransaction }, ...transactions]);
    setText("");
    setAmount("");
    setFile(null);
  } catch (err) {
    console.error("addTransaction failed:", err);
    alert("Failed to add transaction: " + (err.message || "See console for details"));
  }
};



  // Trigger delete confirmation
  const confirmDeleteTransaction = (id) => {
    setConfirmMessage("Are you sure you want to delete this transaction?");
    setConfirmAction(() => async () => {
      await deleteDoc(doc(db, "transactions", id));
      setTransactions(transactions.filter((tx) => tx.id !== id));
      setIsConfirmOpen(false);
    });
    setIsConfirmOpen(true);
  };

  // Trigger logout confirmation
  const confirmLogout = () => {
    setConfirmMessage("Are you sure you want to log out?");
    setConfirmAction(() => () => {
      logout();
      setIsConfirmOpen(false);
    });
    setIsConfirmOpen(true);
  };

  // Open edit modal
  const openEditModal = (transaction) => {
    setIsEditing(true);
    setEditId(transaction.id);
    setEditText(transaction.text);
    setEditAmount(transaction.amount);
  };

  // Save edited transaction
  const saveEdit = async () => {
    if (!editText || !editAmount) return alert("Please enter both fields");
    const docRef = doc(db, "transactions", editId);
    await updateDoc(docRef, {
      text: editText,
      amount: parseFloat(editAmount),
    });

    setTransactions(
      transactions.map((tx) =>
        tx.id === editId ? { ...tx, text: editText, amount: parseFloat(editAmount) } : tx
      )
    );

    closeModal();
  };

  // Close edit modal
  const closeModal = () => {
    setIsEditing(false);
    setEditId(null);
    setEditText("");
    setEditAmount("");
  };

  const income = transactions
    .filter((tx) => tx.amount > 0)
    .reduce((acc, tx) => acc + tx.amount, 0);

  const expense = transactions
    .filter((tx) => tx.amount < 0)
    .reduce((acc, tx) => acc + tx.amount, 0);

  const balance = income + expense;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-indigo-200 to-purple-200 p-4">
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-lg">
        <h1 className="text-3xl font-extrabold text-center mb-6 text-indigo-800">💸 Finance Tracker</h1>

        {!user ? (
          <div className="text-center">
            <p className="mb-4">Sign in to track your transactions</p>
            <button
              onClick={login}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 transition"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium">Welcome, {user.displayName}</span>
              <button onClick={confirmLogout} className="text-sm text-red-500 hover:underline">
                Logout
              </button>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-xl font-medium text-gray-700">Current Balance</h2>
              <p className="text-3xl font-bold text-indigo-600">₹{balance.toFixed(2)}</p>
              <div className="flex justify-around mt-6 text-sm font-semibold">
                <div className="bg-green-100 rounded-xl px-4 py-2 shadow-inner">
                  <p className="text-green-700">Income</p>
                  <p className="text-lg font-bold">₹{income.toFixed(2)}</p>
                </div>
                <div className="bg-red-100 rounded-xl px-4 py-2 shadow-inner">
                  <p className="text-red-700">Expense</p>
                  <p className="text-lg font-bold">₹{Math.abs(expense).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <input
                type="text"
                placeholder="Transaction name"
                className="border border-gray-300 p-3 w-full rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <input
                type="number"
                placeholder="Amount (negative = expense)"
                className="border border-gray-300 p-3 w-full rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                type="file"
                className="mb-4"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <button
                className="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl w-full shadow-md hover:bg-indigo-700 transition"
                onClick={addTransaction}
              >
                ➕ Add Transaction
              </button>
            </div>

            <h3 className="text-lg font-semibold mb-3 text-gray-700">Transaction History</h3>
            <ul className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-400">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className={`flex justify-between items-center p-3 rounded-2xl shadow border-l-8 ${
                    tx.amount > 0 ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                  }`}
                >
                  <span className="font-medium text-gray-800">{tx.text}</span>
                  {tx.fileUrl && (
                    <a
                      href={tx.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline ml-2"
                    >
                      📎 View File
                    </a>
                  )}
                  <div className="flex items-center gap-4">
                    <span className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.amount > 0 ? "+" : "-"}₹{Math.abs(tx.amount)}
                    </span>
                    <button
                      onClick={() => openEditModal(tx)}
                      className="text-blue-500 hover:text-blue-700 text-lg"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => confirmDeleteTransaction(tx.id)}
                      className="text-gray-400 hover:text-red-600 text-lg"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4">Edit Transaction</h2>
            <input
              type="text"
              placeholder="Transaction name"
              className="border p-2 w-full rounded mb-3"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount (negative = expense)"
              className="border p-2 w-full rounded mb-4"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-80">
            <p className="text-lg mb-6">{confirmMessage}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (typeof confirmAction === "function") {
                    confirmAction();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
