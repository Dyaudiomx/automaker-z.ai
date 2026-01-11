import { createFileRoute } from '@tanstack/react-router';
import { TerminalView } from '@/components/views/terminal-view';

export const Route = createFileRoute('/terminal')({
  component: TerminalView,
});
