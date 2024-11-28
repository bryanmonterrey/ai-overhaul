import React from "react"

export default function InsufficientTokens() {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Insufficient Token Holdings</h1>
          <p>
            You need to hold at least $20 worth of GOATSE tokens to access the chat.
          </p>
          <a 
            href="https://jupiter.exchange" // or your preferred DEX
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-white/10 border border-white"
          >
            Buy GOATSE Tokens
          </a>
        </div>
      </div>
    );
  }