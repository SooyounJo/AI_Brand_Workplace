import Head from "next/head";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>AI Branding WorkPlace</title>
        <meta
          name="description"
          content="AI Branding WorkPlace — ambient WebGL canvas experience"
        />
      </Head>
      <main className="hero">
        <div className="hero-main">
          <h1 className="hero-title">
            <span className="hero-title__ai">AI</span>
            <span className="hero-title__line">Branding</span>
            <span className="hero-title__line">WorkPlace</span>
          </h1>
        </div>
        <Footer />
      </main>
    </>
  );
}
