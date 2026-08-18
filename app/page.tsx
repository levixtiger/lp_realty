import { AuthenticatedPanel } from "./clerk-panel";
import { ListingPanel } from "./listings-panel";

const demoMode = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function Home() {
  return demoMode ? <ListingPanel mode="demo" /> : <AuthenticatedPanel />;
}
