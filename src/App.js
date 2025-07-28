// App.js - Enhanced Finance Tracker (React, Tailwind CSS)
import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");

  const addTransaction = () => {
    if (!text || !amount) return alert("Please enter both fields");
    const newTransaction = {
      id: uuidv4(),
      text,
      amount: parseFloat(amount),
    };
    setTransactions([newTransaction, ...transactions]);
    setText("");
    setAmount("");
  };

  const deleteTransaction = (id) => {
    setTransactions(transactions.filter((tx) => tx.id !== id));
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
              className={`flex justify-between items-center p-3 rounded-2xl shadow border-l-8 transition-transform hover:scale-[1.01] duration-200 cursor-pointer ${
                tx.amount > 0 ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
              }`}
            >
              <span className="font-medium text-gray-800">{tx.text}</span>
              <div className="flex items-center gap-4">
                <span className={`font-bold ${
                  tx.amount > 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {tx.amount > 0 ? "+" : "-"}₹{Math.abs(tx.amount)}
                </span>
                <button
                  onClick={() => deleteTransaction(tx.id)}
                  className="text-gray-400 hover:text-red-600 text-lg"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
