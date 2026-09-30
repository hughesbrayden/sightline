// The start page is retired: the demo's Summary tab now carries the pitch and results, and its
// "How we built this" tab the architecture. The old page is in git history. The read-only API is unchanged.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/story.html");
}
