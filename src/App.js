import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function App() {
  const { user, login, logout } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");

  // Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editAmount, setEditAmount] = useState("");

  // Confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

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

  // Add a transaction
  const addTransaction = async () => {
    if (!text || !amount) return alert("Please enter both fields");
    const newTransaction = {
      text,
      amount: parseFloat(amount),
      owner: user.uid,
    };
    await addDoc(collection(db, "transactions"), newTransaction);
    setTransactions([newTransaction, ...transactions]);
    setText("");
    setAmount("");
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
                className="border border-gray-300 p-3 w-full rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
                    confirmAction(); // Explicitly call the action
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
