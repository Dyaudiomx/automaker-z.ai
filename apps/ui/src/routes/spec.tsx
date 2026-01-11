import { createFileRoute } from '@tanstack/react-router';
import { SpecView } from '@/components/views/spec-view';

export const Route = createFileRoute('/spec')({
  component: SpecView,
});
