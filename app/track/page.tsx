import { TrackFind } from "@/components/tracker";
import { Ready, TopBar, Tx } from "@/components/ui";

export default function TrackPage() {
  return (
    <>
      <TopBar back="/" title={<Tx k="t.find" />} />
      <Ready>
        <TrackFind />
      </Ready>
    </>
  );
}
