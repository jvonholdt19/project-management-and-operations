import { redirect } from "next/navigation";
import { getBoard } from "@/lib/data";
import BoardClient from "./board-client";

export default async function BoardPage() {
  const board = await getBoard();
  if (!board) redirect("/login");
  return <BoardClient board={board} />;
}
