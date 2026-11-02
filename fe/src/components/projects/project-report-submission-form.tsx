'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  projectReportSubmissionsApi,
  projectsApi,
  publicReportFormApi,
} from '@/lib/api';
import type { ProjectReportSubmissionPrefill } from '@/lib/types';
import { formatPeriod } from '@/lib/format';
import { currentCalendarPeriod } from '@/lib/period';
import {
  PERIOD_MONTH_MAX,
  PERIOD_MONTH_MIN,
} from '@/lib/period-input-bounds';
import { isValidAmount, normalizeAmount } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fetchAllPaginated } from '@/lib/fetch-all-paginated';
import { uploadOneProjectReportFile } from '@/lib/api/project-report-staged-upload';

type LineDraft = {
  contractId: string;
  contractNo: string;
  contractName: string;
  reportedPlannedAmount: string;
  note: string;
};

type ProjectOption = {
  id: string;
  code: string;
  name: string;
  projectManagerName?: string | null;
};

type ProjectBlock = {
  projectId: string;
  code: string;
  name: string;
  lines: LineDraft[];
  driveFolderUrl: string | null;
};

const UNASSIGNED_KST = '__unassigned_kst__';

type StagedReportFile = {
  localKey: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  fileId?: string;
  error?: string;
};

function prefillToLines(prefill: ProjectReportSubmissionPrefill): LineDraft[] {
  return prefill.contracts.map((c) => ({
    contractId: c.contractId,
    contractNo: c.contractNo,
    contractName: c.contractName,
    reportedPlannedAmount: '',
    note: '',
  }));
}

export function ProjectReportSubmissionForm({
  onSubmitted,
  publicForm = false,
  workspacePeriod,
  initialProjectId,
}: {
  onSubmitted?: (submissionId: string) => void;
  publicForm?: boolean;
  /** Kỳ tháng từ workspace — ẩn chọn tháng trùng trên form */
  workspacePeriod?: string;
  initialProjectId?: string;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(publicForm);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [kstKey, setKstKey] = useState('');
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  const [period, setPeriod] = useState(
    workspacePeriod ?? currentCalendarPeriod(),
  );
  const [prefill, setPrefill] = useState<ProjectReportSubmissionPrefill | null>(
    null,
  );
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [projectBlocks, setProjectBlocks] = useState<ProjectBlock[]>([]);
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedReportFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const uploadGenerationRef = useRef(0);
  const [publicSuccess, setPublicSuccess] = useState(false);
  const [lastBatchCount, setLastBatchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);
    const load = publicForm
      ? publicReportFormApi.listProjects()
      : fetchAllPaginated((page, limit) =>
          projectsApi.list({
            page,
            limit,
            sortBy: 'code',
            sortOrder: 'asc',
          }),
        ).then((rows) =>
          rows.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            projectManagerName: p.projectManagerName ?? null,
          })),
        );

    load
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setProjects([]);
          setProjectsError(
            err instanceof Error
              ? err.message
              : 'Không tải được danh sách dự án',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicForm]);

  useEffect(() => {
    if (workspacePeriod) setPeriod(workspacePeriod);
  }, [workspacePeriod]);

  useEffect(() => {
    if (initialProjectId) setProjectId(initialProjectId);
  }, [initialProjectId]);

  const kstOptions = useMemo(() => {
    if (!publicForm) return [];
    const names = new Set<string>();
    for (const p of projects) {
      const name = p.projectManagerName?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) =>
      a.localeCompare(b, 'vi', { sensitivity: 'base' }),
    );
  }, [projects, publicForm]);

  const hasUnassignedProjects = useMemo(
    () =>
      publicForm &&
      projects.some((p) => !p.projectManagerName?.trim()),
    [projects, publicForm],
  );

  const projectsForKst = useMemo(() => {
    if (!publicForm || !kstKey) return [];
    if (kstKey === UNASSIGNED_KST) {
      return projects.filter((p) => !p.projectManagerName?.trim());
    }
    return projects.filter(
      (p) => p.projectManagerName?.trim() === kstKey,
    );
  }, [projects, kstKey, publicForm]);

  const loadPrefillSingle = useCallback(async () => {
    if (!projectId || !period) return;
    setLoadingPrefill(true);
    setPrefill(null);
    try {
      const data = await projectReportSubmissionsApi.prefill(projectId, period);
      setPrefill(data);
      setLines(prefillToLines(data));
      if (data.contracts.length === 0) {
        toast.error('Dự án này chưa có hợp đồng');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không tải được dữ liệu mẫu',
      );
      setLines([]);
    } finally {
      setLoadingPrefill(false);
    }
  }, [projectId, period]);

  const loadPrefillForKst = useCallback(async () => {
    if (!publicForm || !kstKey || !period || projectsForKst.length === 0) {
      setProjectBlocks([]);
      return;
    }
    setLoadingPrefill(true);
    setProjectBlocks([]);
    try {
      const results = await Promise.all(
        projectsForKst.map(async (p) => {
          try {
            const data = await publicReportFormApi.prefill(p.id, period);
            return {
              projectId: p.id,
              code: p.code,
              name: p.name,
              lines: prefillToLines(data),
              driveFolderUrl: data.driveFolderUrl,
            } satisfies ProjectBlock;
          } catch {
            return {
              projectId: p.id,
              code: p.code,
              name: p.name,
              lines: [],
              driveFolderUrl: null,
            } satisfies ProjectBlock;
          }
        }),
      );
      setProjectBlocks(results);
      const withContracts = results.filter((b) => b.lines.length > 0);
      if (withContracts.length === 0) {
        toast.error('Các dự án của KST này chưa có hợp đồng');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không tải được hợp đồng',
      );
      setProjectBlocks([]);
    } finally {
      setLoadingPrefill(false);
    }
  }, [publicForm, kstKey, period, projectsForKst]);

  useEffect(() => {
    if (publicForm) {
      void loadPrefillForKst();
      return;
    }
    if (projectId && period) {
      void loadPrefillSingle();
    }
  }, [
    publicForm,
    loadPrefillForKst,
    loadPrefillSingle,
    projectId,
    period,
  ]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const updateLineSingle = (contractId: string, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((l) =>
        l.contractId === contractId ? { ...l, ...patch } : l,
      ),
    );
  };

  const updateLineInBlock = (
    projectIdForLine: string,
    contractId: string,
    patch: Partial<LineDraft>,
  ) => {
    setProjectBlocks((prev) =>
      prev.map((block) =>
        block.projectId === projectIdForLine
          ? {
              ...block,
              lines: block.lines.map((l) =>
                l.contractId === contractId ? { ...l, ...patch } : l,
              ),
            }
          : block,
      ),
    );
  };

  const blocksWithContracts = useMemo(
    () => projectBlocks.filter((b) => b.lines.length > 0),
    [projectBlocks],
  );

  const driveFolderUrl = publicForm
    ? (projectBlocks.find((b) => b.driveFolderUrl)?.driveFolderUrl ?? null)
    : (prefill?.driveFolderUrl ?? null);

  const filesUploading = stagedFiles.some((f) => f.status === 'uploading');
  const stagedFileIds = useMemo(
    () =>
      stagedFiles
        .filter((f) => f.status === 'done' && f.fileId)
        .map((f) => f.fileId!),
    [stagedFiles],
  );

  const startUploadSelectedFiles = useCallback(
    (fileList: File[]) => {
      const generation = ++uploadGenerationRef.current;
      const items: StagedReportFile[] = fileList.map((file) => ({
        localKey: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'uploading',
      }));
      setStagedFiles(items);

      const uploadOpts = publicForm ? { skipAuth: true as const } : undefined;

      void Promise.all(
        items.map(async (item) => {
          try {
            const fileId = await uploadOneProjectReportFile(
              item.file,
              (pct) => {
                if (uploadGenerationRef.current !== generation) return;
                setStagedFiles((prev) =>
                  prev.map((row) =>
                    row.localKey === item.localKey
                      ? { ...row, progress: pct }
                      : row,
                  ),
                );
              },
              uploadOpts,
            );
            if (uploadGenerationRef.current !== generation) return;
            setStagedFiles((prev) =>
              prev.map((row) =>
                row.localKey === item.localKey
                  ? { ...row, status: 'done', progress: 100, fileId }
                  : row,
              ),
            );
          } catch (err) {
            if (uploadGenerationRef.current !== generation) return;
            const message =
              err instanceof Error ? err.message : 'Upload thất bại';
            setStagedFiles((prev) =>
              prev.map((row) =>
                row.localKey === item.localKey
                  ? { ...row, status: 'error', error: message }
                  : row,
              ),
            );
            toast.error(`${item.file.name}: ${message}`);
          }
        }),
      );
    },
    [publicForm],
  );

  const handleSubmit = async () => {
    if (stagedFiles.length === 0) {
      toast.error('Đính kèm ít nhất một file báo cáo');
      return;
    }
    if (filesUploading) {
      toast.error('File đang tải lên — đợi 100% rồi nộp báo cáo');
      return;
    }
    if (stagedFileIds.length !== stagedFiles.length) {
      toast.error('Có file lỗi upload — chọn lại file báo cáo');
      return;
    }

    if (publicForm) {
      if (!kstKey) {
        toast.error('Chọn tên KST');
        return;
      }
      if (blocksWithContracts.length === 0) {
        toast.error('Không có hợp đồng để nộp');
        return;
      }
      for (const block of blocksWithContracts) {
        for (const line of block.lines) {
          if (!isValidAmount(line.reportedPlannedAmount)) {
            toast.error(
              `Kiểm tra số tiền — ${block.code} / HĐ ${line.contractNo}`,
            );
            return;
          }
        }
      }

      setSubmitting(true);
      try {
        const fileIds = stagedFileIds;

        const sharedTitle =
          title.trim() ||
          `Báo cáo ${kstKey === UNASSIGNED_KST ? 'dự án' : kstKey} · ${formatPeriod(period)}`;
        const sharedNote = note.trim() || undefined;
        let lastId = '';
        for (const block of blocksWithContracts) {
          const result = await publicReportFormApi.create({
            projectId: block.projectId,
            period,
            title: `${sharedTitle} — ${block.code}`,
            note: sharedNote,
            lines: block.lines.map((l) => ({
              contractId: l.contractId,
              reportedPlannedAmount: Number(
                normalizeAmount(l.reportedPlannedAmount),
              ),
              note: l.note.trim() || undefined,
            })),
            fileIds,
          });
          lastId = result.id;
        }
        setLastBatchCount(blocksWithContracts.length);
        toast.success(
          `Đã nộp ${blocksWithContracts.length} báo cáo (theo từng dự án)`,
        );
        setStagedFiles([]);
        setPublicSuccess(true);
        onSubmitted?.(lastId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Nộp báo cáo thất bại');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!projectId) {
      toast.error('Chọn dự án');
      return;
    }
    if (lines.length === 0) {
      toast.error('Chưa có hợp đồng để nộp');
      return;
    }
    for (const line of lines) {
      if (!isValidAmount(line.reportedPlannedAmount)) {
        toast.error(
          `Kiểm tra số tiền kế hoạch nghiệm thu — hợp đồng ${line.contractNo}`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const fileIds = stagedFileIds;

      const result = await projectReportSubmissionsApi.create({
        projectId,
        period,
        title: title.trim() || undefined,
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          contractId: l.contractId,
          reportedPlannedAmount: Number(normalizeAmount(l.reportedPlannedAmount)),
          note: l.note.trim() || undefined,
        })),
        fileIds,
      });
      toast.success('Đã nộp báo cáo thành công');
      setStagedFiles([]);
      onSubmitted?.(result.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nộp báo cáo thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (publicForm && publicSuccess) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-lg font-medium text-slate-900">
          Cảm ơn bạn — đã ghi nhận báo cáo
        </p>
        <p className="text-sm text-slate-600">
          Đã nộp {lastBatchCount} báo cáo cho {lastBatchCount} dự án.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPublicSuccess(false);
            setKstKey('');
            setProjectBlocks([]);
            setTitle('');
            setNote('');
          }}
        >
          Nộp báo cáo khác
        </Button>
      </div>
    );
  }

  const showPublicFormBody =
    publicForm &&
    kstKey &&
    !loadingPrefill &&
    (projectBlocks.length > 0 || blocksWithContracts.length > 0);

  const showInternalFormBody =
    !publicForm && !loadingPrefill && lines.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {publicForm ? (
          <div className="space-y-1 md:col-span-2">
            <Label>Tên KST *</Label>
            <Select
              value={kstKey}
              disabled={projectsLoading || projects.length === 0}
              onChange={(e) => {
                setKstKey(e.target.value);
                setProjectBlocks([]);
              }}
            >
              <option value="">
                {projectsLoading
                  ? 'Đang tải danh sách KST…'
                  : kstOptions.length === 0 && !hasUnassignedProjects
                    ? 'Chưa có KST — liên hệ quản trị'
                    : 'Chọn tên KST'}
              </option>
              {kstOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {hasUnassignedProjects ? (
                <option value={UNASSIGNED_KST}>— Chưa gán KST —</option>
              ) : null}
            </Select>
            {kstKey && !projectsLoading ? (
              <p className="text-xs text-slate-600">
                {projectsForKst.length} dự án:{' '}
                {projectsForKst.map((p) => p.code).join(', ')}
              </p>
            ) : null}
            {projectsError ? (
              <p className="text-xs text-red-600">{projectsError}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1 md:col-span-2">
            <Label>Dự án *</Label>
            <Select
              value={projectId}
              disabled={projectsLoading || projects.length === 0}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">
                {projectsLoading
                  ? 'Đang tải danh sách dự án…'
                  : projects.length === 0
                    ? 'Không có dự án — liên hệ quản trị'
                    : 'Chọn dự án'}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
            {projectsError ? (
              <p className="text-xs text-red-600">{projectsError}</p>
            ) : null}
          </div>
        )}
        <div className="space-y-1">
          <Label>Kỳ báo cáo *</Label>
          {workspacePeriod ? (
            <p className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums text-slate-800">
              {formatPeriod(workspacePeriod)}
            </p>
          ) : (
            <Input
              type="month"
              min={PERIOD_MONTH_MIN}
              max={PERIOD_MONTH_MAX}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          )}
        </div>
        {!publicForm ? (
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={!projectId || loadingPrefill}
              onClick={() => void loadPrefillSingle()}
            >
              Tải lại hợp đồng
            </Button>
          </div>
        ) : null}
      </div>

      {driveFolderUrl ? (
        <p className="text-sm text-slate-600">
          Thư mục Drive tham chiếu:{' '}
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-teal-800 underline"
          >
            Mở Google Drive
          </a>
        </p>
      ) : null}

      {loadingPrefill ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          {publicForm
            ? 'Đang tải hợp đồng các dự án…'
            : 'Đang tải danh sách hợp đồng…'}
        </div>
      ) : showPublicFormBody || showInternalFormBody ? (
        <>
          {publicForm ? (
            <div className="space-y-8">
              <p className="text-sm font-medium text-slate-800">
                Kế hoạch nghiệm thu · {formatPeriod(period)}
              </p>
              {projectBlocks.map((block) => (
                <section key={block.projectId} className="space-y-3">
                  <div className="border-b border-slate-200 pb-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {block.code}
                    </p>
                    <h3 className="text-lg font-bold leading-snug text-slate-900">
                      {block.name}
                    </h3>
                  </div>
                  {block.lines.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Dự án này chưa có hợp đồng — bỏ qua khi nộp.
                    </p>
                  ) : (
                    block.lines.map((line) => (
                      <fieldset
                        key={line.contractId}
                        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <legend className="px-1 text-sm font-medium text-slate-900">
                          {line.contractNo}
                        </legend>
                        <p className="text-xs text-slate-600">
                          {line.contractName}
                        </p>
                        <div className="space-y-1">
                          <Label>Kế hoạch nghiệm thu trong báo cáo *</Label>
                          <MoneyInput
                            value={line.reportedPlannedAmount}
                            onChange={(v) =>
                              updateLineInBlock(block.projectId, line.contractId, {
                                reportedPlannedAmount: v,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Ghi chú (tùy chọn)</Label>
                          <Input
                            value={line.note}
                            onChange={(e) =>
                              updateLineInBlock(block.projectId, line.contractId, {
                                note: e.target.value,
                              })
                            }
                            placeholder="Ghi chú cho hợp đồng này"
                          />
                        </div>
                      </fieldset>
                    ))
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-b border-slate-200 pb-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {selectedProject?.code ?? ''}
                </p>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedProject?.name ?? ''}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Kế hoạch nghiệm thu · {formatPeriod(period)}
                </p>
              </div>
              {lines.map((line) => (
                <fieldset
                  key={line.contractId}
                  className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <legend className="px-1 text-sm font-medium text-slate-900">
                    {line.contractNo}
                  </legend>
                  <p className="text-xs text-slate-600">{line.contractName}</p>
                  <div className="space-y-1">
                    <Label>Kế hoạch nghiệm thu trong báo cáo *</Label>
                    <MoneyInput
                      value={line.reportedPlannedAmount}
                      onChange={(v) =>
                        updateLineSingle(line.contractId, {
                          reportedPlannedAmount: v,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Ghi chú (tùy chọn)</Label>
                    <Input
                      value={line.note}
                      onChange={(e) =>
                        updateLineSingle(line.contractId, {
                          note: e.target.value,
                        })
                      }
                      placeholder="Ghi chú cho hợp đồng này"
                    />
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Tiêu đề báo cáo</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Báo cáo nghiệm thu tháng 10/2026"
              />
            </div>
            <div className="space-y-1">
              <Label>File báo cáo *</Label>
              <Input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                disabled={submitting}
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  if (picked.length > 0) startUploadSelectedFiles(picked);
                }}
              />
              {stagedFiles.length > 0 ? (
                <ul className="space-y-2 text-xs text-slate-600">
                  {stagedFiles.map((row) => (
                    <li key={row.localKey}>
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{row.file.name}</span>
                        <span
                          className={`shrink-0 tabular-nums ${
                            row.status === 'error'
                              ? 'text-red-600'
                              : row.status === 'done'
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                          }`}
                        >
                          {row.status === 'error'
                            ? 'Lỗi'
                            : row.status === 'done'
                              ? 'Xong'
                              : `${row.progress}%`}
                        </span>
                      </div>
                      {row.status !== 'error' ? (
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full transition-[width] duration-150 ${
                              row.status === 'done'
                                ? 'bg-emerald-600'
                                : 'bg-slate-700'
                            }`}
                            style={{ width: `${row.progress}%` }}
                          />
                        </div>
                      ) : (
                        <p className="mt-0.5 text-red-600">{row.error}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Ghi chú chung</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={
              submitting ||
              filesUploading ||
              stagedFiles.length === 0 ||
              stagedFileIds.length !== stagedFiles.length ||
              (publicForm && blocksWithContracts.length === 0)
            }
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {submitting
              ? 'Đang lưu báo cáo…'
              : filesUploading
                ? 'Đang tải file…'
                : publicForm && blocksWithContracts.length > 1
                  ? `Nộp báo cáo (${blocksWithContracts.length} dự án)`
                  : 'Nộp báo cáo'}
          </Button>
        </>
      ) : publicForm && kstKey && !loadingPrefill ? (
        <p className="text-sm text-slate-500">
          Không có hợp đồng cho các dự án của KST này.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          {publicForm ? 'Chọn tên KST để bắt đầu.' : 'Chọn dự án để bắt đầu.'}
        </p>
      )}
    </div>
  );
}
