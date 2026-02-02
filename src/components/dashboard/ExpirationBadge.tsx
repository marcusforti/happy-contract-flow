import { differenceInDays, isPast, parseISO } from "date-fns";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExpirationBadgeProps {
  expiresAt: string | null;
  status: string;
}

export function ExpirationBadge({ expiresAt, status }: ExpirationBadgeProps) {
  if (!expiresAt || status === "completed" || status === "expired") {
    return null;
  }

  const expirationDate = parseISO(expiresAt);
  const daysUntilExpiration = differenceInDays(expirationDate, new Date());
  const isExpired = isPast(expirationDate);

  if (isExpired) {
    return (
      <Badge 
        variant="destructive" 
        className="text-[10px] px-1.5 py-0.5 bg-destructive/20 text-destructive border-destructive/30"
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        Expirado
      </Badge>
    );
  }

  if (daysUntilExpiration <= 3) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
            >
              <Clock className="h-3 w-3 mr-1" />
              {daysUntilExpiration === 0 
                ? "Expira hoje" 
                : daysUntilExpiration === 1 
                  ? "Expira amanhã" 
                  : `${daysUntilExpiration} dias`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="bg-card border-border text-foreground"
          >
            <p className="text-xs">
              Contrato expira em {daysUntilExpiration} dia{daysUntilExpiration !== 1 ? 's' : ''}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (daysUntilExpiration <= 7) {
    return (
      <Badge 
        variant="outline" 
        className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground border-border"
      >
        <Clock className="h-3 w-3 mr-1" />
        {daysUntilExpiration} dias
      </Badge>
    );
  }

  return null;
}
