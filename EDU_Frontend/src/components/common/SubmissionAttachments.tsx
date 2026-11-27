import React from 'react';
import { Paperclip } from 'lucide-react';
import { STATIC_BASE_URL } from '@/config';

export default function SubmissionAttachments({ files }: { files: { id?: number; title?: string; url: string }[] }) {
  return <ul className="space-y-2">
    {files.map((file, index) => {
      let href = '';
      try {
        const parsed = new URL(file.url, new URL(STATIC_BASE_URL || '/', window.location.origin));
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') href = parsed.href;
      } catch { /* 非法附件地址不提供跳转。 */ }
      return <li key={file.id ?? index} className="min-w-0">
        {href && <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 text-sm text-cyan-700 hover:underline">
          <Paperclip className="h-4 w-4 shrink-0" /><span className="truncate">{file.title || file.url.split('/').pop()}</span>
        </a>}
      </li>;
    })}
  </ul>;
}
