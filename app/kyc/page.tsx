import { Kyc } from "@/components/kyc";
import { Ready, TopBar, Tx } from "@/components/ui";

export default function KycPage() {
  return (
    <>
      <TopBar back="/quote" title={<Tx k="kyc.title" />} />
      <Ready>
        <Kyc />
      </Ready>
    </>
  );
}
