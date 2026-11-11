import { useState } from "react";
import { limits, requiredText } from "@hero-factory/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../../components/ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "../../../components/ui/dialog.js";
import { Input } from "../../../components/ui/input.js";
import { ApiError } from "../../../lib/api-client.js";
import { dateTimeLocalToIsoUtc } from "../../../lib/dates.js";
import { useIdempotencyKey } from "../../../lib/use-idempotency-key.js";
import { useCreateMission } from "../api.js";

// Validação local sobre o formato datetime-local (sem fuso), convertido
// para ISO UTC só no envio (apps/web/CLAUDE.md). A checagem de
// ends_at > starts_at é repetida aqui porque opera sobre o valor local,
// antes da conversão — o schema de criação do shared continua sendo a
// validação de verdade, aplicada pela API sobre o valor já convertido.
const missionFormSchema = z
  .object({
    title: requiredText(limits.mission.title),
    starts_at: z.string().min(1, { message: "Campo obrigatório." }),
    ends_at: z.string().min(1, { message: "Campo obrigatório." }),
  })
  .refine(
    (data) =>
      new Date(data.ends_at).getTime() > new Date(data.starts_at).getTime(),
    {
      message: "O fim da missão deve ser depois do início.",
      path: ["ends_at"],
    },
  );

type MissionFormValues = z.infer<typeof missionFormSchema>;

export interface MissionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionFormDialog({
  open,
  onOpenChange,
}: MissionFormDialogProps) {
  const createMission = useCreateMission();
  const { idempotencyKey, resetIdempotencyKey } = useIdempotencyKey(open);
  const [formBanner, setFormBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MissionFormValues>({
    resolver: zodResolver(missionFormSchema),
  });

  async function onSubmit(values: MissionFormValues) {
    setFormBanner(null);

    try {
      await createMission.mutateAsync({
        body: {
          title: values.title,
          starts_at: dateTimeLocalToIsoUtc(values.starts_at),
          ends_at: dateTimeLocalToIsoUtc(values.ends_at),
        },
        idempotencyKey,
      });
      resetIdempotencyKey();
      reset();
      onOpenChange(false);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "VALIDATION_ERROR" &&
        error.fields
      ) {
        for (const [field, message] of Object.entries(error.fields)) {
          if (
            field === "title" ||
            field === "starts_at" ||
            field === "ends_at"
          ) {
            setError(field, { type: "server", message });
          }
        }
        return;
      }
      setFormBanner(
        error instanceof ApiError
          ? error.message
          : "Ocorreu um erro inesperado.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          reset();
          setFormBanner(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader title="Criar missão" />
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
                <span className="font-bold text-gray-900">Título</span>
                <Input
                  placeholder="Digite o título da missão"
                  {...register("title")}
                />
                {errors.title ? (
                  <span className="text-sm text-danger">
                    {errors.title.message}
                  </span>
                ) : null}
              </label>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="font-bold text-gray-900">Início</span>
                  <Input type="datetime-local" {...register("starts_at")} />
                  {errors.starts_at ? (
                    <span className="text-sm text-danger">
                      {errors.starts_at.message}
                    </span>
                  ) : null}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="font-bold text-gray-900">Fim</span>
                  <Input type="datetime-local" {...register("ends_at")} />
                  {errors.ends_at ? (
                    <span className="text-sm text-danger">
                      {errors.ends_at.message}
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
