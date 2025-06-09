import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Header from "../components/Header"; // Adjust path if necessary

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="relative">
        <Component {...pageProps} />
      </div>
    </div>
  );
}
