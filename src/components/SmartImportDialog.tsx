import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles } from 'lucide-react';
import { SmartImportInline } from './SmartImportInline';
import type { WarehouseCountry } from '@/lib/types';

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfideDossier?: (preset: { product: string; weight: number; origin: WarehouseCountry; destination: string; estimatedCost: number }) => void;
}

export function SmartImportDialog({ open, onOpenChange, onConfideDossier }: SmartImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-foreground" />
            Smart Import Assistant
          </DialogTitle>
          <DialogDescription>
            Décrivez votre import. Notre IA propose 3 routes (rapide, équilibrée, économique) avec coût et délai.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="py-2">
            <SmartImportInline
              variant="plain"
              onConfideDossier={(preset) => {
                onOpenChange(false);
                onConfideDossier?.(preset);
              }}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
