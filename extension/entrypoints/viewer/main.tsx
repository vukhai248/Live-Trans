import { render } from 'preact';
import { useState } from 'preact/hooks';
import * as pdfjsLib from 'pdfjs-dist';
import 'katex/dist/katex.min.css';
import type { ViewMode } from '@/lib/pdf/types';
import type { ReaderMode } from './components/Toolbar/types';

import { usePdfDocument } from './hooks/usePdfDocument';
import { useSettingsManager } from './hooks/useSettingsManager';
import { useVisionWorkerQueue } from './hooks/useVisionWorkerQueue';
import { useSyncScroll } from './hooks/useSyncScroll';

import { ViewerToolbar } from './components/Toolbar/ViewerToolbar';
import { SettingsModal } from './components/SettingsModal/SettingsModal';
import { PostSavePromptModal } from './components/SettingsModal/PostSavePromptModal';
import { ApiKeyWarningBanner } from './components/ApiKeyWarningBanner';
import { SidebarDrawer } from './components/SidebarDrawer';
import { DraggableSplitter } from './components/DraggableSplitter';
import { PageRenderer } from './components/PageRenderer';
import { VisionPageRenderer } from './VisionPageRenderer';
import { WhiteboardPageRenderer } from './WhiteboardPageRenderer';

// Cấu hình PDF.js worker từ extension runtime bundle
if (!pdfjsLib.GlobalWorkerOptions.workerSrc && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
}

export function ViewerApp() {
  const [viewMode, setViewMode] = useState<ViewMode>('bilingual');
  const [readerMode, setReaderMode] = useState<ReaderMode>('vision');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState<number>(0.45);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const [hoveredSentenceId, setHoveredSentenceId] = useState<string | null>(null);

  // 1. Hook quản trị PDF Document & Fit Scale
  const { pdfDoc, pdfUrl, docTitle, numPages, errorMsg, leftFitScale, rightFitScale } = usePdfDocument({
    splitRatio, sidebarOpen, isSidebarPinned, viewMode,
  });

  // 2. Hook quản trị Cấu hình & API Keys
  const {
    settings, updateSettingDirect, isSettingsOpen, setIsSettingsOpen,
    showAutoSaveBadge, triggerAutoSaveBadge, keyItems, modalProviderKeys,
    newKeyProvider, setNewKeyProvider, newKeyText, setNewKeyText,
    handleAddKey, handleRemoveKey, hasActiveKey,
    isPostSavePromptOpen, setIsPostSavePromptOpen,
  } = useSettingsManager();

  // 3. Hook Hàng đợi Song song & Worker Engine
  const {
    pageVisionTranslations, pageVisionStatus, pageVisionErrors,
    activePriorityPages, pendingPriorityPages,
    debouncedPrioritizePage, retryVisionPage, retranslateAllVision,
    processVisionQueue,
  } = useVisionWorkerQueue({
    pdfDoc, pdfUrl, numPages, currentPage: 1, settings, readerMode, hasActiveKey,
  });

  // 4. Hook Cuộn Đồng bộ & Khóa Trần
  const {
    leftPaneRef, rightPaneRef, currentPage,
    effectiveLeftScale, effectiveRightScale,
    handleLeftScroll, handleRightScroll, scrollToPage, resetZoom,
  } = useSyncScroll({
    viewMode, readerMode, numPages, splitRatio, sidebarOpen, isSidebarPinned, pdfDoc,
    leftFitScale, rightFitScale,
    onPrioritizePage: debouncedPrioritizePage,
  });

  const handleReset5050 = () => {
    setSplitRatio(0.5);
    resetZoom();
  };

  if (errorMsg) {
    return (
      <div class="lt-center-msg">
        <h2>Lỗi khi tải tài liệu</h2>
        <p>{errorMsg}</p>
        <button class="lt-btn lt-btn-primary" onClick={() => window.location.reload()}>
          Thử lại
        </button>
      </div>
    );
  }

  if (!pdfDoc) {
    return (
      <div class="lt-center-msg">
        <div class="lt-spinner" style={{ width: '32px', height: '32px' }} />
        <h2>Đang chuẩn bị trình đọc & dịch Live-Trans...</h2>
        <p>{docTitle}</p>
      </div>
    );
  }

  return (
    <div
      id="app"
      class={`lt-app-container lt-theme-${settings.viewerTheme || 'white'} ${sidebarOpen ? 'lt-sidebar-open' : ''} ${isSidebarPinned ? 'lt-sidebar-pinned' : ''}`}
      style={{
        '--lt-font-scale': `${(settings.viewerFontScale || 100) / 100}`,
        '--lt-font-family': settings.viewerFontFamily || 'system',
      } as any}
    >
      <ApiKeyWarningBanner
        hasActiveKey={hasActiveKey}
        provider={settings.pdfProvider}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ViewerToolbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        docTitle={docTitle}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        onResetSplitRatio={handleReset5050}
        readerMode={readerMode}
        onChangeReaderMode={setReaderMode}
        isModeMenuOpen={isModeMenuOpen}
        onToggleModeMenu={() => setIsModeMenuOpen((v) => !v)}
        onCloseModeMenu={() => setIsModeMenuOpen(false)}
        currentPage={currentPage}
        numPages={numPages}
        onPageChange={scrollToPage}
        onRetranslateAll={retranslateAllVision}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div class="lt-main lt-main-viewport">
        <SidebarDrawer
          isOpen={sidebarOpen}
          isPinned={isSidebarPinned}
          numPages={numPages}
          currentPage={currentPage}
          onSelectPage={scrollToPage}
          onTogglePin={() => setIsSidebarPinned((v) => !v)}
          onClose={() => setSidebarOpen(false)}
          pageVisionStatus={pageVisionStatus}
          readerMode={readerMode}
          activePriorityPages={activePriorityPages}
          pendingPriorityPages={pendingPriorityPages}
        />

        <main class="lt-workspace lt-panes-wrapper">
          {(viewMode === 'bilingual' || viewMode === 'original') && (
            <div
              ref={leftPaneRef}
              class="lt-pane lt-pane-left lt-left-pane"
              style={{ width: viewMode === 'bilingual' ? `${splitRatio * 100}%` : '100%', flex: 'none' }}
              onScroll={handleLeftScroll}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pno) => (
                <PageRenderer
                  key={pno}
                  pageNumber={pno}
                  pdfDoc={pdfDoc}
                  scale={effectiveLeftScale}
                  hoveredSentenceId={hoveredSentenceId}
                  onHoverSentence={setHoveredSentenceId}
                  onVisible={debouncedPrioritizePage}
                />
              ))}
            </div>
          )}

          {viewMode === 'bilingual' && (
            <DraggableSplitter
              splitRatio={splitRatio}
              isDragging={isDraggingSplitter}
              onMouseDown={() => setIsDraggingSplitter(true)}
              onReset5050={handleReset5050}
              onSplitRatioChange={setSplitRatio}
            />
          )}

          {(viewMode === 'bilingual' || viewMode === 'translated') && (
            <div
              ref={rightPaneRef}
              class={`lt-pane lt-pane-right lt-right-pane lt-theme-${settings.viewerTheme || 'white'} lt-font-${settings.viewerFontFamily || 'system'}`}
              style={{
                width: viewMode === 'bilingual' ? `${(1 - splitRatio) * 100}%` : '100%',
                flex: 'none',
                '--lt-content-scale': `${(settings.viewerFontScale || 100) / 100}`,
                '--lt-viewer-font-size': `${settings.viewerFontSize || 15}px`,
              } as any}
              onScroll={handleRightScroll}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pno) =>
                readerMode === 'whiteboard' ? (
                  <WhiteboardPageRenderer
                    key={pno}
                    pdfDoc={pdfDoc}
                    pageNumber={pno}
                    scale={effectiveRightScale}
                    heightScale={viewMode === 'bilingual' ? effectiveLeftScale : effectiveRightScale}
                    blocks={[]}
                    hoveredSentenceId={hoveredSentenceId}
                    onHoverSentence={setHoveredSentenceId}
                    onVisible={debouncedPrioritizePage}
                    status={pageVisionStatus[pno] === 'done' ? 'done' : pageVisionStatus[pno] === 'error' ? 'error' : 'loading'}
                    untranslatedCount={0}
                    onRetry={retryVisionPage}
                    visionMarkdown={pageVisionTranslations[pno] || ''}
                  />
                ) : (
                  <VisionPageRenderer
                    key={pno}
                    pdfDoc={pdfDoc}
                    pageNumber={pno}
                    scale={effectiveRightScale}
                    heightScale={viewMode === 'bilingual' ? effectiveLeftScale : effectiveRightScale}
                    markdownText={pageVisionTranslations[pno] || ''}
                    status={pageVisionStatus[pno] || 'loading'}
                    errorMsg={pageVisionErrors[pno] || ''}
                    hasApiKey={hasActiveKey}
                    onVisible={debouncedPrioritizePage}
                    onRetry={retryVisionPage}
                    isPriority={activePriorityPages.includes(pno) || pendingPriorityPages.includes(pno)}
                  />
                )
              )}
            </div>
          )}
        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettingDirect={updateSettingDirect}
        keyItems={keyItems}
        modalProviderKeys={modalProviderKeys}
        newKeyProvider={newKeyProvider}
        onSetNewKeyProvider={setNewKeyProvider}
        newKeyText={newKeyText}
        onSetNewKeyText={setNewKeyText}
        onAddKey={handleAddKey}
        onRemoveKey={handleRemoveKey}
        onRetranslateAll={retranslateAllVision}
        showAutoSaveBadge={showAutoSaveBadge}
        triggerAutoSaveBadge={triggerAutoSaveBadge}
      />

      <PostSavePromptModal
        isOpen={isPostSavePromptOpen}
        onClose={() => setIsPostSavePromptOpen(false)}
        currentPage={currentPage}
        onRetryCurrentPage={retryVisionPage}
        onRetranslateAll={retranslateAllVision}
        onContinueReading={processVisionQueue}
      />
    </div>
  );
}

render(<ViewerApp />, document.getElementById('app')!);
