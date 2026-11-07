import { Suspense } from "react";
import { Tracker } from "@/components/tracker";
import { PageSkeleton, Ready, TopBar, Tx } from "@/components/ui";

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Tracker id={id.toUpperCase()} />;
}

export default function OrderPage(props: PageProps<"/track/[id]">) {
  return (
    <>
      <TopBar back="/track" title={<Tx k="t.title" />} />
      <Ready>
        <Suspense fallback={<PageSkeleton />}>
          <Body params={props.params} />
        </Suspense>
      </Ready>
    </>
  );
}
