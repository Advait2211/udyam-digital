import { QuotePage } from "@/components/quote";
import { Ready, TopBar, Tx } from "@/components/ui";

export default function Quote() {
  return (
    <>
      <TopBar back="/advisor" title={<Tx k="q.title" />} />
      <Ready>
        <QuotePage />
      </Ready>
    </>
  );
}
