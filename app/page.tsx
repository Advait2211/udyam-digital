import { Landing } from "@/components/landing";
import { Ready } from "@/components/ui";

export default function Home() {
  return (
    <Ready fallback={<div className="grain min-h-screen" />}>
      <Landing />
    </Ready>
  );
}
