import { createFileRoute } from '@tanstack/react-router';
import { ProfilesView } from '@/components/views/profiles-view';

export const Route = createFileRoute('/profiles')({
  component: ProfilesView,
});
