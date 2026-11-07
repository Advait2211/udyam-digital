import { Advisor } from "@/components/advisor";
import { Ready, TopBar, Tx } from "@/components/ui";

export default function AdvisorPage() {
  return (
    <>
      <TopBar back="/" title={<Tx k="adv.title" />} />
      <Ready>
        <Advisor />
      </Ready>
    </>
  );
}
