import {
  ILayoutRestorer,
  JupyterLab,
  JupyterLabPlugin
} from "@jupyterlab/application";

import { IEditorServices } from "@jupyterlab/codeeditor";

import { IRenderMimeRegistry } from "@jupyterlab/rendermime";

import { InstanceTracker } from "@jupyterlab/apputils";

import { NotebookPanel } from "@jupyterlab/notebook";

import { StackedPanel } from "@phosphor/widgets";

import * as renderers from "@jupyterlab/rendermime";

import "../style/index.css";

import { ASTGenerate } from "./analysis/ast-generate";

import { NotebookListen } from "./jupyter-hooks/notebook-listen";

import { HistoryModel } from "./history-model";

import { VerdantPanel } from "./widgets/verdant-panel";

import { GhostBookFactory, GhostBook } from "./widgets/ghost-book";

import { RenderBaby } from "./jupyter-hooks/render-baby";

/**
 * Initialization data for the Verdant extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: "Verdant",
  activate: (
    app: JupyterLab,
    restorer: ILayoutRestorer,
    rendermime: IRenderMimeRegistry,
    latexTypesetter: renderers.ILatexTypesetter,
    contentFactory: NotebookPanel.IContentFactory,
    editorServices: IEditorServices
  ) => {
    const { shell } = app;
    const panel = new StackedPanel();
    var activePanel: NotebookPanel;
    const linkHandler = {
      handleLink: (node: HTMLElement, path: string) => {
        app.commandLinker.connectNode(node, "docmanager:open", { path: path });
      }
    };
    var notebook: NotebookListen;
    const renderBaby = new RenderBaby(latexTypesetter, linkHandler);
    const model = new HistoryModel(renderBaby);
    const astUtils = new ASTGenerate(model);

    const ghostFactory = new GhostBookFactory({
      name: "Ghost",
      modelName: "notebook",
      fileTypes: ["ghost"],
      defaultFor: ["ghost"],
      readOnly: true,
      rendermime: rendermime,
      contentFactory,
      editorConfig: null,
      mimeTypeService: editorServices.mimeTypeService
    });
    const ghostTracker = new InstanceTracker<GhostBook>({
      namespace: "ghostbook"
    });

    // Handle state restoration.
    restorer.restore(ghostTracker, {
      command: "docmanager:open",
      args: widget => ({ path: widget.context.path, factory: "Ghost" }),
      name: widget => "Run of " + widget.context.path
    });

    app.docRegistry.addWidgetFactory(ghostFactory);
    app.docRegistry.addFileType({
      name: "ghost",
      extensions: [".ghost"],
      fileFormat: "json",
      mimeTypes: ["application/x-ipynb+json"],
      iconClass: "jp-MaterialIcon v-Verdant-GhostBook-icon "
    });
    console.log("Doc registrey is:", app.docRegistry);

    ghostFactory.widgetCreated.connect((sender, widget) => {
      // Notify the instance tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => {
        ghostTracker.save(widget);
      });
      ghostTracker.add(widget);

      const types = app.docRegistry.getFileTypesForPath(widget.context.path);

      if (types.length > 0) {
        widget.title.iconClass = GhostBook.GHOST_BOOK_ICON;
      }
    });

    restorer.add(panel, "v-VerdantPanel");
    panel.id = "v-VerdantPanel";
    panel.title.label = "Verdant";
    const verdantPanel = new VerdantPanel(model);
    panel.addWidget(verdantPanel);

    shell.addToLeftArea(panel, { rank: 600 });

    app.restored.then(() => {
      const populate = () => {
        var widg = shell.currentWidget;
        if (widg instanceof NotebookPanel) {
          verdantPanel.onNotebookSwitch(widg);
          if (!activePanel || activePanel !== widg) {
            activePanel = widg;
            notebook = new NotebookListen(activePanel, astUtils, model);
            notebook.ready.then(() => {
              console.log("Notebook is ready");
            });
          }
        }
      };

      // Connect signal handlers.
      shell.layoutModified.connect(() => {
        populate();
      });

      // Populate the tab manager.
      populate();
    });
  },
  autoStart: true,
  requires: [
    ILayoutRestorer,
    IRenderMimeRegistry,
    renderers.ILatexTypesetter,
    NotebookPanel.IContentFactory,
    IEditorServices
  ]
};

export default extension;
