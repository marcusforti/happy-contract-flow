import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users } from "lucide-react";

interface Signatory {
  id: string;
  name: string;
  email: string;
  signed_at: string | null;
}

interface ContractProgressBarProps {
  signatories: Signatory[];
  className?: string;
}

export function ContractProgressBar({ signatories, className }: ContractProgressBarProps) {
  const totalSignatories = signatories.length;
  const signedCount = signatories.filter(s => s.signed_at).length;
  const progress = totalSignatories > 0 ? (signedCount / totalSignatories) * 100 : 0;
  
  const pendingSignatories = signatories.filter(s => !s.signed_at);
  
  if (totalSignatories === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={className}>
            <div className="flex items-center gap-2 mb-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {signedCount} de {totalSignatories} assinatura{totalSignatories > 1 ? 's' : ''}
              </span>
            </div>
            <Progress 
              value={progress} 
              className="h-1.5 bg-muted"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-card border-border text-foreground max-w-xs"
        >
          {pendingSignatories.length > 0 ? (
            <div className="space-y-1">
              <p className="font-medium text-xs text-primary">Aguardando assinatura:</p>
              {pendingSignatories.map(s => (
                <p key={s.id} className="text-xs text-muted-foreground">
                  • {s.name}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-400">Todas as assinaturas coletadas!</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
