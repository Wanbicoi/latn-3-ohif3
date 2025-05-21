import React, { useState } from 'react';
import { PanelSection, ScrollArea, Checkbox, Label, Button, Icons } from '../../components';
import { useSegmentationTableContext } from './SegmentationTableContext';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../lib/utils';

const taskId = new URLSearchParams(window.location.search).get('taskId');

export const SegmentationComments: React.FC<{
  segmentation?: any;
  representation?: any;
  activeSegmentId: number;
}> = ({ segmentation, representation, activeSegmentId }) => {
  const { activeSegmentationId, data, mode } = useSegmentationTableContext(
    'SegmentationTable.Segments'
  );

  let segmentationToUse = segmentation;
  let representationToUse = representation;
  let segmentationIdToUse = activeSegmentationId;
  if (!segmentationToUse || !representationToUse) {
    const entry = data.find(seg => seg.segmentation.segmentationId === activeSegmentationId);
    segmentationToUse = entry?.segmentation;
    representationToUse = entry?.representation;
    segmentationIdToUse = entry?.segmentation.segmentationId;
  }

  if (!representationToUse || !segmentationToUse) {
    return null;
  }

  const segmentCount = Object.keys(representationToUse.segments).length;
  const height = mode === 'collapsed' ? 'h-[300px]' : `h-[${segmentCount * 200}px]`;

  return (
    <PanelSection className="mt-0.5">
      <PanelSection.Header>
        <div className="flex items-center">
          <Icons.DicomTagBrowser className="mr-2 h-4 w-4" />
          <span>Comments</span>
        </div>
      </PanelSection.Header>
      <PanelSection.Content className="flex-shrink-0">
        <ScrollArea
          className={`ohif-scrollbar invisible-scrollbar bg-bkg-low space-y-px ${height}`}
          showArrows={true}
        >
          <ResolveCommentSection />

          {Object.values(representationToUse.segments).map((segment: any) => {
            if (!segment) {
              return null;
            }
            const { segmentIndex } = segment;
            const segmentFromSegmentation = segmentationToUse.segments[segmentIndex];
            if (!segmentFromSegmentation) {
              return null;
            }

            return (
              segmentIndex == activeSegmentId && (
                <CommentList
                  key={segmentIndex}
                  segmentId={segmentFromSegmentation.label}
                />
              )
            );
          })}
        </ScrollArea>
      </PanelSection.Content>
    </PanelSection>
  );
};
function ResolveCommentSection() {
  const { data: has_comments_completed, isLoading, refetch } = useQuery({
    queryKey: [`tasks/${taskId}/has_comments_completed`],
    queryFn: async () => {
      const { data } = await supabaseClient
        .from('hd_batches_resources')
        .select('has_comments_completed')
        .eq('id', taskId)
        .single();
      return data.has_comments_completed;
    },
  });
  if (isLoading) return;
  return (
    <div className="items-top flex space-x-2 p-2">
      <Checkbox
        checked={has_comments_completed}
        onCheckedChange={async e => {
          await supabaseClient
            .from('hd_batches_resources')
            .update({ has_comments_completed: e })
            .eq('id', taskId);
          refetch()
        }}
      />
      <div className="grid gap-1.5 pt-0.5 leading-none">
        <Label>Mark comments completed</Label>
      </div>
    </div>
  );
}

function CommentList({ segmentId }) {
  const { data: comments, refetch } = useQuery({
    queryKey: [`comments/${taskId}/segments/${segmentId}`],
    queryFn: async () => await getComments(segmentId),
  });
  return (
    <>
      {comments?.map(({ id, content, name, created_at }) => (
        <Comment
          key={id}
          content={content}
          name={name}
          created_at={created_at}
        />
      ))}
      <AddComment
        segmentId={segmentId}
        onFetch={refetch}
      />
    </>
  );
}

function Comment({ content, name, created_at }) {
  const renderDetailText = (text: string, indent: number = 0) => {
    const indentation = '  '.repeat(indent);
    if (text === '') {
      return (
        <div
          key={`empty-${indent}`}
          className="h-2"
        ></div>
      );
    }
    return (
      <div
        key={content}
        className="whitespace-pre-wrap"
      >
        {indentation}
        <span className="font-medium">{content}</span>
      </div>
    );
  };
  return (
    <div className="bg-popover mb-2 rounded-lg p-2">
      <div className="flex justify-between">
        <div className="text-muted-foreground">{name}</div>
        <div className="text-secondary-foreground text-xxs">
          {new Date(created_at).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-1 pt-1 text-base leading-normal">
        <div className="text-foreground">{renderDetailText(content)}</div>
      </div>
    </div>
  );
}

function AddComment({ segmentId, onFetch }) {
  const [content, setContent] = useState<string>();
  return (
    <div>
      <textarea
        className="border-inputfield-main focus:border-inputfield-focus disabled:border-inputfield-disabled w-full appearance-none rounded border bg-black py-2 px-3 text-sm leading-tight text-white shadow transition duration-300 focus:outline-none"
        onChange={e => setContent(e.target.value)}
        placeholder="Enter your comment here..."
        value={content}
      />
      <Button
        className="ml-auto mb-8 p-2"
        onClick={async () => {
          await addComment(segmentId, content);
          onFetch();
          setContent('');
        }}
      >
        Submit comment
      </Button>
    </div>
  );
}

async function getComments(segmentId: string) {
  const { data } = await supabaseClient
    .from('hd_task_comments')
    .select('id, name, content, created_at')
    .eq('segment_id', segmentId)
    .eq('task_id', taskId);
  return data;
}

async function addComment(segmentId: string, content: string) {
  await supabaseClient.from('hd_comments').insert({
    segment_id: segmentId,
    content: content,
    task_id: taskId,
  });
}
