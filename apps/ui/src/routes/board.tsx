import { createFileRoute } from '@tanstack/react-router';
import { BoardView } from '@/components/views/board-view';

export const Route = createFileRoute('/board')({
  component: BoardView,
});
