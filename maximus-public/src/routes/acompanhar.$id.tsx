import { createFileRoute, useParams } from "@tanstack/react-router";
import { TrackPageContent } from "./acompanhar";

export const Route = createFileRoute("/acompanhar/$id")({
  head: () => ({
    meta: [
      { title: "Maximus" },
      { name: "description", content: "Acompanhe seu pedido na Maximus" },
    ],
  }),
  component: TrackOrderByIdPage,
});

function TrackOrderByIdPage() {
  const { id } = useParams({ from: "/acompanhar/$id" });
  return <TrackPageContent orderId={id} />;
}
