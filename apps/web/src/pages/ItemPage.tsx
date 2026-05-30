import { useParams, useNavigate } from "react-router-dom";
import type { MediaType } from "@geeklogs/shared";
import { ItemPageContent } from "@/components/ItemPageContent";

export function ItemPage() {
  const navigate = useNavigate();
  const { mediaType, id } = useParams<{ mediaType: MediaType; id: string }>();

  if (!mediaType || !id) return null;

  return (
    <ItemPageContent
      key={`${mediaType}:${id}`}
      mediaType={mediaType}
      id={id}
      onBack={() => navigate(-1)}
    />
  );
}
