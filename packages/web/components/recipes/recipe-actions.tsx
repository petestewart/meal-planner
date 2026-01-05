'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Pencil, Trash2, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToggleFavorite, useDeleteRecipe } from '@/lib/queries';
import { cn } from '@/lib/utils';

interface RecipeActionsProps {
  recipeId: string;
  isFavorite: boolean;
  className?: string;
}

/**
 * Recipe action buttons: Add to Plan, Favorite, Edit, Delete
 */
export function RecipeActions({
  recipeId,
  isFavorite,
  className,
}: RecipeActionsProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const toggleFavorite = useToggleFavorite();
  const deleteRecipe = useDeleteRecipe({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      router.push('/recipes');
    },
  });

  const handleFavoriteClick = () => {
    toggleFavorite.mutate(recipeId);
  };

  const handleDelete = () => {
    deleteRecipe.mutate(recipeId);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Favorite Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleFavoriteClick}
        disabled={toggleFavorite.isPending}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        className="h-10 w-10 sm:h-9 sm:w-9 touch-manipulation"
      >
        <Heart
          className={cn(
            'h-5 w-5 transition-colors',
            isFavorite
              ? 'fill-red-500 text-red-500'
              : 'text-muted-foreground hover:text-red-500'
          )}
        />
      </Button>

      {/* Edit Button */}
      <Button variant="ghost" size="icon" asChild aria-label="Edit recipe" className="h-10 w-10 sm:h-9 sm:w-9 touch-manipulation">
        <Link href={`/recipes/${recipeId}/edit`}>
          <Pencil className="h-5 w-5" />
        </Link>
      </Button>

      {/* Delete Button with Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Delete recipe"
            className="text-muted-foreground hover:text-destructive h-10 w-10 sm:h-9 sm:w-9 touch-manipulation"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recipe</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this recipe? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteRecipe.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRecipe.isPending}
            >
              {deleteRecipe.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AddToPlanButtonProps {
  recipeId: string;
  className?: string;
}

/**
 * Add to Plan button - opens plan selection flow
 * For now, links to the planner page
 */
export function AddToPlanButton({ recipeId, className }: AddToPlanButtonProps) {
  // TODO: Implement plan selection modal/drawer
  // For now, we navigate to the planner with recipe context
  return (
    <Button className={className} asChild>
      <Link href={`/planner?addRecipe=${recipeId}`}>
        <CalendarPlus className="h-4 w-4" />
        Add to Plan
      </Link>
    </Button>
  );
}
