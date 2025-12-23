import { useState, useCallback, useRef, useMemo } from 'react';
import { ScrollPosition, Anchor, Alignment } from '@/types/schemas';

/**
 * Sync Scroll Hook
 * Synchronizes scrolling between two PDF viewers based on alignment anchors
 *
 * Constraints:
 * - Maximum drift: ≤20px
 * - Manual scroll override: disable sync for 2 seconds after manual target scroll
 */

interface UseSyncScrollParams {
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  alignments: Alignment[];
  enabled: boolean;
}

interface UseSyncScrollReturn {
  handleSourceScroll: (position: ScrollPosition) => void;
  targetScrollPosition: ScrollPosition | null;
  drift: number;
}

const MAX_DRIFT_PX = 20;
const MANUAL_SCROLL_OVERRIDE_MS = 2000;

export function useSyncScroll({
  sourceAnchors,
  targetAnchors,
  alignments,
  enabled,
}: UseSyncScrollParams): UseSyncScrollReturn {
  const [targetScrollPosition, setTargetScrollPosition] = useState<ScrollPosition | null>(null);
  const [drift, setDrift] = useState(0);
  const manualScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [manualScrollDisabled, setManualScrollDisabled] = useState(false);

  // Precompute lookup maps to avoid O(N+A+T) linear searches on every scroll event
  // This reduces hot path from O(N+K+A+T) to O(K) per scroll
  const pageToSourceAnchors = useMemo(() => {
    const map = new Map<number, Anchor[]>();
    sourceAnchors.forEach(anchor => {
      if (!map.has(anchor.page)) {
        map.set(anchor.page, []);
      }
      map.get(anchor.page)!.push(anchor);
    });
    return map;
  }, [sourceAnchors]);

  const sourceAnchorIdToAlignment = useMemo(() => {
    const map = new Map<string, Alignment>();
    alignments.forEach(alignment => {
      map.set(alignment.sourceAnchorId, alignment);
    });
    return map;
  }, [alignments]);

  const anchorIdToTargetAnchor = useMemo(() => {
    const map = new Map<string, Anchor>();
    targetAnchors.forEach(anchor => {
      map.set(anchor.anchorId, anchor);
    });
    return map;
  }, [targetAnchors]);

  /**
   * Handle scroll event from source PDF viewer
   */
  const handleSourceScroll = useCallback(
    (position: ScrollPosition) => {
      if (!enabled || manualScrollDisabled) return;

      const viewportHeight = position.viewportHeight;

      // Find nearest alignment anchor to current scroll position
      const nearestAlignment = findNearestAlignment(
        position,
        pageToSourceAnchors,
        sourceAnchorIdToAlignment,
        anchorIdToTargetAnchor
      );

      if (!nearestAlignment) {
        return;
      }

      const { sourceAnchor, targetAnchor, proportionalOffset } = nearestAlignment;

      // Calculate target scroll position
      const targetY = targetAnchor.rect.y + proportionalOffset * targetAnchor.rect.h;

      const targetPosition: ScrollPosition = {
        page: targetAnchor.page,
        offsetY: 0, // Will be calculated based on normalizedY
        normalizedY: targetY,
      };

      // Apply drift constraint (convert normalized drift to pixels using viewport height when available)
      const calculatedDrift = Math.abs(position.normalizedY - targetPosition.normalizedY);
      const driftPx = viewportHeight
        ? calculatedDrift * viewportHeight
        : calculatedDrift * 1000; // fallback to previous approximation
      setDrift(driftPx);

      // Apply constraint
      if (driftPx <= MAX_DRIFT_PX) {
        setTargetScrollPosition(targetPosition);
      }
    },
    [enabled, manualScrollDisabled, pageToSourceAnchors, sourceAnchorIdToAlignment, anchorIdToTargetAnchor]
  );

  /**
   * Disable sync scroll temporarily when target is manually scrolled
   */
  const disableSyncTemporarily = useCallback(() => {
    if (manualScrollTimeoutRef.current) {
      clearTimeout(manualScrollTimeoutRef.current);
    }

    setManualScrollDisabled(true);

    manualScrollTimeoutRef.current = setTimeout(() => {
      setManualScrollDisabled(false);
    }, MANUAL_SCROLL_OVERRIDE_MS);
  }, []);

  return {
    handleSourceScroll,
    targetScrollPosition,
    drift,
  };
}

/**
 * Find the nearest alignment anchor to the current scroll position
 * Uses precomputed lookup maps for O(K) performance instead of O(N+K+A+T)
 */
function findNearestAlignment(
  position: ScrollPosition,
  pageToSourceAnchors: Map<number, Anchor[]>,
  sourceAnchorIdToAlignment: Map<string, Alignment>,
  anchorIdToTargetAnchor: Map<string, Anchor>
): {
  sourceAnchor: Anchor;
  targetAnchor: Anchor;
  proportionalOffset: number;
} | null {
  // O(1) lookup instead of O(N) filter
  const sourceAnchorsOnPage = pageToSourceAnchors.get(position.page);

  if (!sourceAnchorsOnPage || sourceAnchorsOnPage.length === 0) return null;

  // Find nearest source anchor based on scroll position - O(K) where K = anchors on page
  let nearestSourceAnchor: Anchor | null = null;
  let minDistance = Infinity;

  for (const anchor of sourceAnchorsOnPage) {
    const anchorY = anchor.rect.y + anchor.rect.h / 2; // Center of anchor
    const distance = Math.abs(anchorY - position.normalizedY);

    if (distance < minDistance) {
      minDistance = distance;
      nearestSourceAnchor = anchor;
    }
  }

  if (!nearestSourceAnchor) return null;

  // O(1) lookup instead of O(A) find
  const alignment = sourceAnchorIdToAlignment.get(nearestSourceAnchor.anchorId);

  if (!alignment) return null;

  // O(1) lookup instead of O(T) find
  const targetAnchor = anchorIdToTargetAnchor.get(alignment.targetAnchorId);

  if (!targetAnchor) return null;

  // Calculate proportional offset within the source anchor
  const anchorTop = nearestSourceAnchor.rect.y;
  const anchorBottom = nearestSourceAnchor.rect.y + nearestSourceAnchor.rect.h;
  const proportionalOffset =
    (position.normalizedY - anchorTop) / (anchorBottom - anchorTop);

  return {
    sourceAnchor: nearestSourceAnchor,
    targetAnchor,
    proportionalOffset: Math.max(0, Math.min(1, proportionalOffset)),
  };
}
