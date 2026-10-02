import PracticeApp from "@/components/PracticeApp";
import { RequireAuth } from "@/components/RequireAuth";

export default function Home() {
  return (
    <RequireAuth next="/">
      <PracticeApp />
    </RequireAuth>
  );
}
