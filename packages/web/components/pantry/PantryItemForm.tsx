'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAddPantryItem, useUpdatePantryItem } from '@/lib/queries';
import type {
  PantryItemWithIngredient,
  PantryLocation,
  AddPantryItemInput,
  UpdatePantryItemInput,
} from '@/types/api';

const LOCATIONS: { value: PantryLocation | ''; label: string }[] = [
  { value: '', label: 'Select location' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'pantry', label: 'Pantry' },
];

interface PantryItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: PantryItemWithIngredient | null;
}

/**
 * Dialog form for adding or editing pantry items
 */
export function PantryItemForm({
  open,
  onOpenChange,
  editItem,
}: PantryItemFormProps) {
  const isEditing = !!editItem;

  const [ingredientName, setIngredientName] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const [location, setLocation] = React.useState<PantryLocation | ''>('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [isPrepared, setIsPrepared] = React.useState(false);
  const [preparationNotes, setPreparationNotes] = React.useState('');
  const [isStaple, setIsStaple] = React.useState(false);

  const addItem = useAddPantryItem();
  const updateItem = useUpdatePantryItem();

  // Populate form when editing
  React.useEffect(() => {
    if (editItem) {
      setIngredientName(editItem.ingredientName);
      setQuantity(editItem.quantity?.toString() || '');
      setUnit(editItem.unit || '');
      setLocation(editItem.location || '');
      setExpiresAt(editItem.expiresAt || '');
      setIsPrepared(editItem.isPrepared);
      setPreparationNotes(editItem.preparationNotes || '');
      setIsStaple(editItem.isStaple);
    } else {
      resetForm();
    }
  }, [editItem, open]);

  const resetForm = () => {
    setIngredientName('');
    setQuantity('');
    setUnit('');
    setLocation('');
    setExpiresAt('');
    setIsPrepared(false);
    setPreparationNotes('');
    setIsStaple(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!ingredientName.trim()) return;

    if (isEditing && editItem) {
      const input: UpdatePantryItemInput = {
        quantity: quantity ? parseFloat(quantity) : null,
        unit: unit || null,
        location: location || null,
        expiresAt: expiresAt || null,
        isPrepared,
        preparationNotes: preparationNotes || null,
        isStaple,
      };

      updateItem.mutate(
        { ingredientName: editItem.ingredientName, input },
        {
          onSuccess: () => {
            onOpenChange(false);
            resetForm();
          },
        }
      );
    } else {
      const input: AddPantryItemInput = {
        ingredientName: ingredientName.trim(),
        quantity: quantity ? parseFloat(quantity) : null,
        unit: unit || null,
        location: location || null,
        expiresAt: expiresAt || null,
        isPrepared,
        preparationNotes: preparationNotes || null,
        isStaple,
      };

      addItem.mutate(input, {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      });
    }
  };

  const isPending = addItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEditing ? 'Edit Pantry Item' : 'Add Pantry Item'}
          </DialogTitle>
          <DialogDescription className="text-body-sm">
            {isEditing
              ? 'Update the details for this item.'
              : 'Add a new item to your pantry inventory.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ingredient name - only editable when adding */}
          <div className="space-y-2">
            <label htmlFor="ingredientName" className="text-body-sm font-medium">
              Ingredient Name *
            </label>
            <Input
              id="ingredientName"
              value={ingredientName}
              onChange={(e) => setIngredientName(e.target.value)}
              placeholder="e.g., Chicken breast"
              disabled={isEditing}
              required
            />
          </div>

          {/* Quantity and Unit in a row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="quantity" className="text-body-sm font-medium">
                Quantity
              </label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g., 2"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="unit" className="text-body-sm font-medium">
                Unit
              </label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., lbs"
              />
            </div>
          </div>

          {/* Location select */}
          <div className="space-y-2">
            <label htmlFor="location" className="text-body-sm font-medium">
              Location
            </label>
            <select
              id="location"
              value={location}
              onChange={(e) =>
                setLocation(e.target.value as PantryLocation | '')
              }
              className="flex h-11 w-full rounded-sm border-[1.5px] border-input bg-transparent px-3 py-2 text-base shadow-sm transition-all duration-200 ease-out focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 md:text-sm"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Expiration date */}
          <div className="space-y-2">
            <label htmlFor="expiresAt" className="text-body-sm font-medium">
              Expiration Date
            </label>
            <Input
              id="expiresAt"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {/* Checkboxes row */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2.5 text-body-sm cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={isPrepared}
                onChange={(e) => setIsPrepared(e.target.checked)}
                className="h-5 w-5 rounded-sm border-[1.5px] border-input accent-primary cursor-pointer"
              />
              Prepared
            </label>
            <label className="flex items-center gap-2.5 text-body-sm cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={isStaple}
                onChange={(e) => setIsStaple(e.target.checked)}
                className="h-5 w-5 rounded-sm border-[1.5px] border-input accent-primary cursor-pointer"
              />
              Staple Item
            </label>
          </div>

          {/* Preparation notes - show when prepared is checked */}
          {isPrepared && (
            <div className="space-y-2">
              <label htmlFor="preparationNotes" className="text-body-sm font-medium">
                Preparation Notes
              </label>
              <Input
                id="preparationNotes"
                value={preparationNotes}
                onChange={(e) => setPreparationNotes(e.target.value)}
                placeholder="e.g., Diced and ready to use"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !ingredientName.trim()}>
              {isPending
                ? 'Saving...'
                : isEditing
                ? 'Save Changes'
                : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
