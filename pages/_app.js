import Head from "next/head";
import Layout from "@/components/Layout";
import NewProjectModal from "@/components/NewProjectModal";
import OrangeSweep from "@/components/OrangeSweep";
import { AppUIProvider } from "@/context/AppUI";
import "@/styles/globals.css";
import "@/styles/workspace.css";

export default function App({ Component, pageProps }) {
  return (
    <AppUIProvider>
      <Layout>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <OrangeSweep />
        <Component {...pageProps} />
        <NewProjectModal />
      </Layout>
    </AppUIProvider>
  );
}
