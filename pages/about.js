import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import SideRail from "@/components/SideRail";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About — AI Branding WorkPlace</title>
        <meta
          name="description"
          content="About the aibrand WebGL canvas experience"
        />
      </Head>
      <div className="workspace">
        <div className="workspace-main">
          <main className="hero">
            <div>
              <h1 className="hero-title hero-title--text">About</h1>
              <p className="hero-copy">
                Next.js Page Router와 React로 구성한 기본 구조에, 고정 WebGL
                캔버스가 전 페이지를 감싸는 앰비언트 레이어로 동작합니다.
              </p>
            </div>
            <Link href="/" className="cta">
              <Image
                src="/btn-new-project.png"
                alt="New Project"
                width={480}
                height={140}
                className="cta__img"
              />
            </Link>
          </main>
        </div>
        <SideRail />
      </div>
    </>
  );
}
