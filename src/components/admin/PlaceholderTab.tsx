import { Sparkles } from 'lucide-react';

export function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl border border-dashed border-border p-16 text-center bg-card">
        <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground">Section bientôt disponible</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Cette vue sera connectée dans une prochaine itération. La donnée nécessaire est déjà collectée en arrière-plan.
        </p>
      </div>
    </div>
  );
}
