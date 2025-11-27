import { NextResponse } from 'next/server';
import { searchSimilarChunksInFile } from '@/lib/vector-search';
import { getFileMetadata } from '@/lib/vector-storage';

export async function POST(req: Request) {
  try {
    const { queryEmbedding, fileId, topK = 5, minScore = 0.3 } = await req.json();

    if (!queryEmbedding || !Array.isArray(queryEmbedding) || !fileId) {
      return NextResponse.json(
        { error: 'Invalid request: queryEmbedding and fileId are required' },
        { status: 400 }
      );
    }

    console.log(`[API Vector Search] Searching for file: ${fileId}, topK: ${topK}, minScore: ${minScore}`);

    // 检查文件是否存在
    const fileMetadata = await getFileMetadata(fileId);
    if (!fileMetadata) {
      console.error(`[API Vector Search] ❌ File ${fileId} not found in database!`);
      return NextResponse.json(
        { error: `File ${fileId} not found in database` },
        { status: 404 }
      );
    }

    // 搜索相似块
    const results = await searchSimilarChunksInFile(
      queryEmbedding,
      fileId,
      topK,
      minScore
    );

    console.log(`[API Vector Search] ✓ Found ${results.length} chunks for file ${fileId}`);

    return NextResponse.json({
      chunks: results.map((result) => ({
        text: result.chunk.text,
        fileId: result.chunk.fileId,
        fileName: fileMetadata.fileName,
        score: result.score,
        chunkIndex: result.chunk.chunkIndex,
      })),
      fileMetadata: {
        id: fileMetadata.id,
        fileName: fileMetadata.fileName,
        threadId: fileMetadata.threadId,
      },
    });
  } catch (error: any) {
    console.error(`[API Vector Search] ✗ Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to search vectors' },
      { status: 500 }
    );
  }
}

