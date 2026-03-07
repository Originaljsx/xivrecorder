import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  useReactTable,
} from '@tanstack/react-table';
import { RendererVideo, AppState } from 'main/types';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import {
  videoToDate,
} from 'renderer/rendererutils';
import { VideoCategory } from 'types/VideoCategory';
import {
  populateResultCell,
  populateDurationCell,
  populateDateCell,
  populateViewpointCell,
  populateDetailsCell,
  populateMapCell,
  populateActivityCell,
} from './Cells';
import {
  ResultHeader,
  DurationHeader,
  DateHeader,
  ViewpointsHeader,
  MapHeader,
  TypeHeader,
  ActivityHeader,
  DetailsHeader,
} from './Headers';
import {
  resultSort,
  durationSort,
  viewPointCountSort,
  detailSort,
  clipActivitySort,
} from './Sorting';
import { getLocaleCategoryLabel } from 'localisation/translations';

const useTable = (
  videoState: RendererVideo[],
  appState: AppState,
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>,
) => {
  const {
    category,
    language,
    videoFilterTags,
    dateRangeFilter,
    storageFilter,
    cloudStatus,
  } = appState;

  /**
   * Tracks if rows are selected or not.
   */
  const [rowSelection, setRowSelection] = useState({});

  /**
   * Controls the table pagnation.
   */
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  /**
   * Deselect all rows on category change or filter change.
   */
  useEffect(() => {
    setRowSelection({});
  }, [category, videoFilterTags, dateRangeFilter, storageFilter]);

  /**
   * The Crystalline Conflict table columns, the data access, sorting functions
   * and any display transformations.
   */
  const ccColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Details',
        size: 80,
        accessorFn: (v) => v,
        sortingFn: (a, b) => detailSort(a, b),
        header: DetailsHeader,
        cell: (ctx) =>
          populateDetailsCell(ctx, language, cloudStatus, setVideoState),
      },
      {
        id: 'Map',
        size: 300,
        accessorKey: 'zoneName',
        header: () => MapHeader(language),
        cell: populateMapCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: (v) => populateViewpointCell(v),
        sortingFn: viewPointCountSort,
      },
    ],
    [language, cloudStatus, setVideoState],
  );

  /**
   * The clips table columns, the data access, sorting functions
   * and any display transformations.
   */
  const clipsColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Details',
        size: 80,
        accessorFn: (v) => v,
        sortingFn: (a, b) => detailSort(a, b),
        header: DetailsHeader,
        cell: (ctx) =>
          populateDetailsCell(ctx, language, cloudStatus, setVideoState),
      },
      {
        id: 'Type',
        accessorKey: 'parentCategory',
        header: () => TypeHeader(language),
        cell: (info) => {
          const category = info.getValue();
          return getLocaleCategoryLabel(language, category as VideoCategory);
        },
      },
      {
        id: 'Activity',
        accessorFn: (v) => v,
        sortingFn: (a, b) => clipActivitySort(a, b, language),
        header: () => ActivityHeader(language),
        cell: (ctx) => populateActivityCell(ctx, language),
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: (v) => populateViewpointCell(v),
        sortingFn: viewPointCountSort,
      },
    ],
    [appState, setVideoState],
  );

  const manualColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Details',
        size: 80,
        accessorFn: (v) => v,
        sortingFn: (a, b) => detailSort(a, b),
        header: DetailsHeader,
        cell: (ctx) =>
          populateDetailsCell(ctx, language, cloudStatus, setVideoState),
      },
      {
        id: 'Type',
        accessorFn: (v) => v,
        header: () => TypeHeader(language),
        cell: 'Manual',
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
    ],
    [appState, setVideoState],
  );

  let columns;

  switch (category) {
    case VideoCategory.CrystallineConflict:
      columns = ccColumns;
      break;
    case VideoCategory.Clips:
      columns = clipsColumns;
      break;
    case VideoCategory.Manual:
      columns = manualColumns;
      break;
    default:
      throw new Error('Unrecognized category');
  }

  /**
   * Prepare the headless table, with sorting and row expansion. This is where
   * the data is passed in to be rendered.
   */
  const table = useReactTable({
    columns,
    data: videoState,
    state: { pagination, rowSelection },
    getRowId: (row) => row.uniqueId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    // This is a workaround for tanstack defaulting to 150px.
    // Also see the VideoSelectionTable component where we react to this.
    defaultColumn: { size: Number.MAX_SAFE_INTEGER },
  });

  return table;
};

export default useTable;
