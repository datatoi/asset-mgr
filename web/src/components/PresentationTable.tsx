import { isValidElement, useState } from 'react';
import type { ReactNode } from 'react';
import { Empty, Pagination, Table } from 'antd';
import type { TableColumnType, TableProps } from 'antd';

/** Keeps desktop Table behavior intact and reuses its cell/action renderers on phones. */
export default function PresentationTable<T extends object>({ mobile = false, ...props }: TableProps<T> & { mobile?: boolean }) {
  const [page, setPage] = useState(1);
  if (!mobile) return <Table<T> {...props} />;
  const rows = props.dataSource || [];
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  const columns = (props.columns || []).filter((column): column is TableColumnType<T> => !column.hidden && !('children' in column));
  return <div className="mobile-stack">
    {!rows.length && <Empty description="No records yet" />}
    {rows.slice((current - 1) * 10, current * 10).map((record, index) => {
      const rowKey = typeof props.rowKey === 'function' ? props.rowKey(record, index) : (record as Record<string, unknown>)[String(props.rowKey || 'key')];
      return <article className="mobile-card mobile-management-card" key={String(rowKey ?? index)}>
        {columns.map((column, fieldIndex) => {
          const path = column.dataIndex === undefined ? [] : Array.isArray(column.dataIndex) ? column.dataIndex : [column.dataIndex];
          const value = path.reduce<unknown>((result, key) => (result as Record<string, unknown> | undefined)?.[String(key)], record);
          const rendered = column.render ? column.render(value, record, (current - 1) * 10 + index) : value;
          const content = rendered && typeof rendered === 'object' && !isValidElement(rendered) && !Array.isArray(rendered) && 'children' in rendered ? rendered.children : rendered;
          const label = typeof column.title === 'string' ? column.title : 'Details';
          return <div className="mobile-management-field" key={String(column.key || fieldIndex)}>
            <span className="mobile-muted">{label}</span><div>{(content ?? '—') as ReactNode}</div>
          </div>;
        })}
      </article>;
    })}
    {rows.length > 10 && <Pagination simple current={current} pageSize={10} total={rows.length} showSizeChanger={false} onChange={setPage} />}
  </div>;
}
