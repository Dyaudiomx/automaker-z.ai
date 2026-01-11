import { useState, useCallback } from 'react';
import { Feature } from '@/store/app-store';
import {
  FeatureImagePath as DescriptionImagePath,
  ImagePreviewMap,
} from '@/components/ui/description-image-dropzone';

export function useFollowUpState() {
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [followUpFeature, setFollowUpFeature] = useState<Feature | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [followUpImagePaths, setFollowUpImagePaths] = useState<DescriptionImagePath[]>([]);
  const [followUpPreviewMap, setFollowUpPreviewMap] = useState<ImagePreviewMap>(() => new Map());

  const resetFollowUpState = useCallback(() => {
    setShowFollowUpDialog(false);
    setFollowUpFeature(null);
    setFollowUpPrompt('');
    setFollowUpImagePaths([]);
    setFollowUpPreviewMap(new Map());
  }, []);

  const handleFollowUpDialogChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetFollowUpState();
      } else {
        setShowFollowUpDialog(open);
      }
    },
    [resetFollowUpState]
  );

  return {
    // State
    showFollowUpDialog,
    followUpFeature,
    followUpPrompt,
    followUpImagePaths,
    followUpPreviewMap,
    // Setters
    setShowFollowUpDialog,
    setFollowUpFeature,
    setFollowUpPrompt,
    setFollowUpImagePaths,
    setFollowUpPreviewMap,
    // Helpers
    resetFollowUpState,
    handleFollowUpDialogChange,
  };
}
