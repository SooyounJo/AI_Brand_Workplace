import Head from "next/head";
import Workspace from "@/components/workspace/Workspace";
import { PROJECTS } from "@/data/projects";

export default function BoardPage({ slug, project }) {
  const title = project?.title || "Brand Board";

  return (
    <>
      <Head>
        <title>{title} — AI Branding WorkPlace</title>
        <meta
          name="description"
          content={project?.summary || "AI Branding workspace board"}
        />
      </Head>
      <Workspace slug={slug} initialProject={project} />
    </>
  );
}

export function getStaticPaths() {
  return {
    paths: PROJECTS.map((item) => ({
      params: { slug: item.slug },
    })),
    fallback: "blocking",
  };
}

export function getStaticProps({ params }) {
  const project = PROJECTS.find((item) => item.slug === params.slug) || null;
  return {
    props: {
      slug: params.slug,
      project,
    },
  };
}
