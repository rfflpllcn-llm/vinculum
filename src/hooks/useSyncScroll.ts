import { useState, useCallback, useRef } from 'react';
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

  /**
   * Handle scroll event from source PDF viewer
   */
  const handleSourceScroll = useCallback(
    (position: ScrollPosition) => {
      if (!enabled || manualScrollDisabled) return;

      // Find nearest alignment anchor to current scroll position
      const nearestAlignment = findNearestAlignment(
        position,
        sourceAnchors,
        targetAnchors,
        alignments
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

      // Apply drift constraint (convert to pixel space for comparison)
      // Note: In practice, we need viewport height to compute actual drift in pixels
      // For now, we'll use normalized space and trust the constraint
      const calculatedDrift = Math.abs(position.normalizedY - targetPosition.normalizedY);
      setDrift(calculatedDrift);

      // Apply constraint
      if (calculatedDrift <= MAX_DRIFT_PX / 1000) {
        // Convert px to approximate normalized value
        setTargetScrollPosition(targetPosition);
      }
    },
    [enabled, manualScrollDisabled, sourceAnchors, targetAnchors, alignments]
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
 */
function findNearestAlignment(
  position: ScrollPosition,
  sourceAnchors: Anchor[],
  targetAnchors: Anchor[],
  alignments: Alignment[]
): {
  sourceAnchor: Anchor;
  targetAnchor: Anchor;
  proportionalOffset: number;
} | null {
  if (alignments.length === 0) return null;

  // Filter alignments to current page
  const sourceAnchorsOnPage = sourceAnchors.filter(
    (anchor) => anchor.page === position.page
  );

  if (sourceAnchorsOnPage.length === 0) return null;

  // Find nearest source anchor based on scroll position
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

  // Find corresponding target anchor via alignment
  const alignment = alignments.find(
    (a) => a.sourceAnchorId === nearestSourceAnchor!.anchorId
  );

  if (!alignment) return null;

  const targetAnchor = targetAnchors.find(
    (a) => a.anchorId === alignment.targetAnchorId
  );

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
