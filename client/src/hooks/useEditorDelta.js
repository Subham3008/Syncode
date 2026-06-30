import { useCallback, useEffect, useRef } from "react";
import {
  applyRemoteDelta,
  createDeltaFromTextChange
} from "../utils/delta.utils.js";

const normalizeDocument = (document) =>
  typeof document === "string" ? document : "";

export const useEditorDelta = ({ document, onDocumentChange, onError } = {}) => {
  const documentRef = useRef(normalizeDocument(document));

  useEffect(() => {
    documentRef.current = normalizeDocument(document);
  }, [document]);

  const replaceDocument = useCallback(
    (nextDocument) => {
      const safeDocument = normalizeDocument(nextDocument);
      documentRef.current = safeDocument;
      onDocumentChange?.(safeDocument);
      return safeDocument;
    },
    [onDocumentChange]
  );

  const applyLocalChange = useCallback(
    (nextText, cursorPosition = null) => {
      const previousDocument = documentRef.current;
      const nextDocument = normalizeDocument(nextText);
      const delta = createDeltaFromTextChange(previousDocument, nextDocument, cursorPosition);

      if (!delta) {
        return null;
      }

      documentRef.current = nextDocument;
      onDocumentChange?.(nextDocument);

      return {
        delta,
        previousDocument,
        nextDocument
      };
    },
    [onDocumentChange]
  );

  const applyRemoteChange = useCallback(
    (payload = {}) => {
      try {
        const nextDocument = applyRemoteDelta(documentRef.current, payload.delta);
        documentRef.current = nextDocument;
        onDocumentChange?.(nextDocument);
        return nextDocument;
      } catch (error) {
        onError?.(error.message || "Could not apply remote editor update");
        return null;
      }
    },
    [onDocumentChange, onError]
  );

  return {
    documentRef,
    replaceDocument,
    applyLocalChange,
    applyRemoteChange
  };
};
