import { useState } from "react";
import {
  type CreateHeroInput,
  type HeroResponse,
  type UpdateHeroInput,
  createHeroSchema,
} from "@hero-factory/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "../../../components/ui/dialog.js";
import { Input } from "../../../components/ui/input.js";
import { todayAsDateInputValue } from "../../../lib/dates.js";
import { ApiError } from "../../../lib/api-client.js";
import { useCreateHero, useUpdateHero } from "../api.js";
import { useIdempotencyKey } from "../../../lib/use-idempotency-key.js";
import { mergeEdits } from "../merge-edits.js";

const EDITABLE_FIELDS = [
  "name",
  "nickname",
  "universe",
  "main_power",
  "date_of_birth",
  "avatar_url",
] as const;

type FieldName = (typeof EDITABLE_FIELDS)[number];

function toFormValues(hero: HeroResponse): CreateHeroInput {
  return {
    name: hero.name,
    nickname: hero.nickname,
    universe: hero.universe,
    main_power: hero.main_power,
    date_of_birth: hero.date_of_birth,
    avatar_url: hero.avatar_url ?? undefined,
  };
}

export interface HeroFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hero?: HeroResponse;
}

export function HeroFormDialog({
  open,
  onOpenChange,
  hero,
}: HeroFormDialogProps) {
  const mode = hero ? "edit" : "create";
  const createHero = useCreateHero();
  const updateHero = useUpdateHero();
  const { idempotencyKey, resetIdempotencyKey } = useIdempotencyKey(open);

  const [baseline, setBaseline] = useState<HeroResponse | undefined>(hero);
  const [formBanner, setFormBanner] = useState<string | null>(null);
  const [previousOpen, setPreviousOpen] = useState(open);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<CreateHeroInput>({
    resolver: zodResolver(createHeroSchema),
    defaultValues: hero ? toFormValues(hero) : undefined,
  });

  // Reinicia o formulário sempre que o modal abre (não a cada render),
  // comparando com o `open` anterior durante a renderização em vez de um
  // useEffect — padrão recomendado para "reagir a uma prop mudando".
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) {
      setBaseline(hero);
      setFormBanner(null);
      reset(hero ? toFormValues(hero) : undefined);
    }
  }

  async function onSubmit(values: CreateHeroInput) {
    setFormBanner(null);

    if (mode === "create") {
      try {
        await createHero.mutateAsync({ body: values, idempotencyKey });
        resetIdempotencyKey();
        onOpenChange(false);
      } catch (error) {
        handleSubmitError(error);
      }
      return;
    }

    if (!baseline) {
      return;
    }

    const patch: Record<string, unknown> = { version: baseline.version };
    for (const field of EDITABLE_FIELDS) {
      if (dirtyFields[field]) {
        patch[field] = values[field];
      }
    }

    try {
      await updateHero.mutateAsync({
        id: baseline.id,
        body: patch as UpdateHeroInput,
      });
      onOpenChange(false);
    } catch (error) {
      handleSubmitError(error, values);
    }
  }

  function handleSubmitError(error: unknown, mineValues?: CreateHeroInput) {
    if (!(error instanceof ApiError)) {
      setFormBanner("Ocorreu um erro inesperado. Tente novamente.");
      return;
    }

    if (error.code === "VALIDATION_ERROR" && error.fields) {
      for (const [field, message] of Object.entries(error.fields)) {
        setError(field as FieldName, { type: "server", message });
      }
      return;
    }

    if (error.code === "DUPLICATE_HERO") {
      setFormBanner(error.message);
      return;
    }

    if (error.code === "VERSION_CONFLICT" && baseline && mineValues) {
      const theirs = error.details as { current?: HeroResponse } | undefined;
      const theirsHero = theirs?.current;
      if (!theirsHero) {
        setFormBanner(error.message);
        return;
      }

      const { merged, conflicts } = mergeEdits(
        toFormValues(baseline),
        mineValues,
        toFormValues(theirsHero),
        [...EDITABLE_FIELDS],
      );

      reset(merged, { keepDirty: false });
      setBaseline(theirsHero);

      for (const field of conflicts) {
        setError(field, {
          type: "conflict",
          message:
            "Outra pessoa também mudou este campo. Revise antes de salvar.",
        });
      }

      toast.warning(
        `${theirsHero.nickname} mudou desde que você abriu. Juntamos as alterações: revise e salve.`,
      );
      return;
    }

    setFormBanner(error.message);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={mode === "create" ? "Criar herói" : "Editar herói"}
        />
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <DialogBody>
            <div className="flex flex-col gap-5">
              {formBanner ? (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-4 py-2 text-sm text-danger"
                >
                  {formBanner}
                </p>
              ) : null}

              <label className="flex flex-col gap-1.5">
                <span className="font-bold text-gray-900">Nome completo</span>
                <Input
                  placeholder="Digite o nome completo"
                  {...register("name")}
                />
                {errors.name ? (
                  <span className="text-sm text-danger">
                    {errors.name.message}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-bold text-gray-900">Nome de guerra</span>
                <Input
                  placeholder="Digite o nome de guerra"
                  {...register("nickname")}
                />
                {errors.nickname ? (
                  <span className="text-sm text-danger">
                    {errors.nickname.message}
                  </span>
                ) : null}
              </label>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="font-bold text-gray-900">
                    Data de nascimento
                  </span>
                  <Input
                    type="date"
                    max={todayAsDateInputValue()}
                    {...register("date_of_birth")}
                  />
                  {errors.date_of_birth ? (
                    <span className="text-sm text-danger">
                      {errors.date_of_birth.message}
                    </span>
                  ) : null}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="font-bold text-gray-900">Universo</span>
                  <Input
                    placeholder="Digite o universo"
                    {...register("universe")}
                  />
                  {errors.universe ? (
                    <span className="text-sm text-danger">
                      {errors.universe.message}
                    </span>
                  ) : null}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="font-bold text-gray-900">Habilidade</span>
                  <Input
                    placeholder="Digite a habilidade"
                    {...register("main_power")}
                  />
                  {errors.main_power ? (
                    <span className="text-sm text-danger">
                      {errors.main_power.message}
                    </span>
                  ) : null}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="font-bold text-gray-900">Avatar</span>
                  <Input
                    placeholder="Digite a URL"
                    {...register("avatar_url")}
                  />
                  {errors.avatar_url ? (
                    <span className="text-sm text-danger">
                      {errors.avatar_url.message}
                    </span>
                  ) : null}
                </label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              shape="rect"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" shape="rect" disabled={isSubmitting}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
