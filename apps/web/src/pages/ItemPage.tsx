import { useParams, useNavigate } from "react-router-dom";
import type { MediaType } from "@logeverything/shared";
import { ItemPageContent } from "@/components/ItemPageContent";

export function ItemPage() {
  const navigate = useNavigate();
  const { mediaType, id } = useParams<{ mediaType: MediaType; id: string }>();

  if (!mediaType || !id) return null;

  return (
    <ItemPageContent
      mediaType={mediaType}
      id={id}
      onBack={() => navigate(-1)}
    />
  );
}
