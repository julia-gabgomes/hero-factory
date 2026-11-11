import { User } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "../../../components/ui/dialog.js";
import { ErrorState } from "../../../components/ui/error-state.js";
import { LoadingState } from "../../../components/ui/loading-state.js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs.js";
import { formatDateOfBirth } from "../../../lib/dates.js";
import { useHeroQuery } from "../api.js";
import { HeroHistoryTab } from "./HeroHistoryTab.js";
import { HeroMissionsTab } from "./HeroMissionsTab.js";

export interface HeroDetailsDialogProps {
  heroId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HeroDetailsDialog({
  heroId,
  open,
  onOpenChange,
}: HeroDetailsDialogProps) {
  const heroQuery = useHeroQuery(heroId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={heroQuery.data?.nickname ?? "Herói"} />
        <DialogBody>
          {heroQuery.isPending ? (
            <LoadingState label="Carregando herói…" />
          ) : heroQuery.isError ? (
            <ErrorState
              message="Não foi possível carregar o herói."
              onRetry={() => void heroQuery.refetch()}
            />
          ) : (
            <Tabs defaultValue="dados">
              <TabsList>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="alteracoes">Alterações</TabsTrigger>
                <TabsTrigger value="missoes">Missões</TabsTrigger>
              </TabsList>

              <TabsContent value="dados">
                <div className="flex flex-col items-center gap-5">
                  <span className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                    {heroQuery.data.avatar_url ? (
                      <img
                        src={heroQuery.data.avatar_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <User
                        className="size-14 text-gray-400"
                        aria-hidden="true"
                      />
                    )}
                  </span>

                  <div className="grid w-full grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    <div>
                      <p className="font-bold text-gray-900">Nome completo:</p>
                      <p className="text-gray-700">{heroQuery.data.name}</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">
                        Data de nascimento
                      </p>
                      <p className="text-gray-700">
                        {formatDateOfBirth(heroQuery.data.date_of_birth)}
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">Universo</p>
                      <p className="text-gray-700">{heroQuery.data.universe}</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">Habilidade</p>
                      <p className="text-gray-700">
                        {heroQuery.data.main_power}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="alteracoes">
                <HeroHistoryTab heroId={heroQuery.data.id} />
              </TabsContent>

              <TabsContent value="missoes">
                <HeroMissionsTab heroId={heroQuery.data.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            shape="rect"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
