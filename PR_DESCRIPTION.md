# 🔧 Fix: Cross-Block Text Deletion & Message Link Feature

## 📋 Overview

This PR fixes critical issues with cross-block text deletion in the Notion-style prompt sidebar and introduces message linking functionality (with highlighting support).

## 🎯 Key Changes

### 1. **Fixed Cross-Block Text Deletion** ✅
- **Issue**: When selecting text across multiple blocks and pressing Delete/Backspace, the deletion was not working properly
- **Root Cause**: 
  - `blocks` state was not being updated when prompts were deleted, causing `useEffect` to recreate prompts
  - Missing `prompts` dependency in `handleGlobalKeyDown` hook
  - `updatePrompt` function didn't support creating new prompts for blocks without corresponding prompts
- **Solution**:
  - Added `prompts` to `handleGlobalKeyDown` dependency array
  - Modified `updatePrompt` to support creating new prompts when they don't exist
  - Synchronized `blocks` state deletion with `prompts` deletion to prevent recreation
  - Enhanced offset calculation for precise text deletion across multiple blocks

### 2. **Message Link Feature** 🔗
- **New Feature**: Added link icon to blocks that were created from dragged messages
- **Implementation**:
  - Extended `PromptItem` interface with `sourceMessageId`, `sourceThreadId`, `sourceMessageRole`, and `sourceMessageTimestamp`
  - Added link icon (from `lucide-react`) that appears when `block.sourceMessageId` exists
  - Implemented `handleScrollToMessage` function in `prompt-panel.tsx`
  - Added `onScrollToMessage` prop chain: `prompt-panel.tsx` → `notion-style-prompt-area.tsx` → `notion-block-editor.tsx`
- **Current Status**: 
  - ✅ Link icon display
  - ✅ Message highlighting when clicked
  - ⏳ Thread switching (partially implemented)
  - ❌ Full navigation to source message (not yet implemented)

### 3. **Enhanced Logging** 📊
- Added comprehensive logging with `[Link]` and `[NotionPromptArea]` prefixes
- Improved debugging for `threadId` resolution during drag-and-drop
- Better error messages for missing prompts/blocks

## 🔧 Technical Details

### Modified Files
- `components/assistant-ui/notion-style-prompt-area.tsx`
  - Fixed `handleGlobalKeyDown` dependency array
  - Added `prompts` synchronization when deleting blocks
  - Enhanced prompt creation logic for blocks without prompts
  - Improved offset calculation for cross-block text deletion
  
- `components/assistant-ui/prompt-panel.tsx`
  - Modified `updatePrompt` to support creating new prompts
  - Implemented `handleScrollToMessage` function
  - Added `onScrollToMessage` prop passing
  
- `components/assistant-ui/notion-block-editor.tsx`
  - Added link icon display logic
  - Implemented `handleScrollToMessage` click handler
  - Added `onScrollToMessage` prop support

- `lib/prompt-storage.ts`
  - Extended `PromptItem` interface with source message tracking fields

- `app/assistant.tsx`
  - Enhanced `handleDragEnd` to extract and pass `threadId` and `messageTimestamp`
  - Improved `threadId` resolution logic with fallback mechanisms
  - Added extensive logging for drag-and-drop operations

## 🐛 Bug Fixes

1. **Cross-Block Text Deletion**: Fixed issue where selecting and deleting text across multiple blocks didn't work
2. **Prompt Recreation**: Fixed infinite loop where deleted prompts were immediately recreated
3. **State Synchronization**: Fixed `blocks` and `prompts` state desynchronization during deletion
4. **Missing Dependencies**: Fixed React hook dependency warnings

## 🧪 Testing Checklist

- [x] Select text within a single block and delete - works correctly
- [x] Select text across multiple blocks and delete - works correctly
- [x] Delete entire block by selecting all text - works correctly
- [x] Verify link icon appears for blocks created from messages
- [x] Verify message highlighting when clicking link icon
- [x] Verify no prompt recreation after deletion
- [x] Test undo/redo after cross-block deletion

## 📝 Known Limitations

- **Message Navigation**: Full navigation to source message is not yet implemented
  - Currently only highlights the message in the current thread
  - Thread switching logic exists but may need refinement
  - Cross-thread navigation needs additional work

## 🔗 Related Issues

- Fixes: Cross-block text deletion not working
- Implements: Message link feature (partial - highlighting only)

## 👥 Reviewers

@[reviewer-1] @[reviewer-2]

## 📝 Additional Notes

- This PR focuses on fixing critical deletion issues and laying the groundwork for message linking
- The message link feature is partially implemented (highlighting works, full navigation pending)
- All changes are backward compatible
- No breaking changes introduced

---

**Developer**: @yubozhou-lab  
**Date**: 2025-01-XX  
**Type**: Bug Fix + Feature (Partial)
