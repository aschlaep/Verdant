import {
  NotebookPanel, Notebook
} from '@jupyterlab/notebook';

import {
  Cell, CodeCell
} from '@jupyterlab/cells';

import {
  PromiseDelegate
} from '@phosphor/coreutils';

import {
  ASTGenerate
} from './ast-generate';

import{
  CellListen
} from './cell-listen'

import{
  KernelListen
} from './kernel-listen'

import{
  Nodey
} from './nodey'

import {
  Model
} from './model'


export
class NotebookListen
{
  notebook : Notebook; //the currently active notebook Verdant is working on
  notebookPanel : NotebookPanel
  kernUtil : KernelListen
  astUtils : ASTGenerate
  cells: Map<Cell, CellListen>
  activeCell : Cell
  historyModel : Model


  constructor(notebookPanel : NotebookPanel, astUtils : ASTGenerate, historyModel : Model){
    this.notebookPanel = notebookPanel
    this.astUtils = astUtils
    this.historyModel = historyModel
    this.cells = new Map<Cell, CellListen>()
    this.init()
  }

  get ready(): Promise<void> {
    return this._ready.promise
  }

  get nodey(): Nodey[] {
    var arr : Nodey[] = []
    this.cells.forEach((value, key) => { arr.push(value.nodey) })
    return arr
  }

  private async init()
  {
    await this.notebookPanel.ready
    this.notebook = this.notebookPanel.notebook
    this.kernUtil = new KernelListen(this.notebookPanel.session)
    this.astUtils.setKernUtil(this.kernUtil)
    await this.astUtils.ready

    var cellsReady : Promise<void>[] = []
    this.notebook.widgets.forEach( (item, index) => {
      if(item instanceof Cell)
      {
        var cell = new CellListen(item, this.astUtils, this.historyModel)
        this.cells.set(item, cell)
        cellsReady.push(cell.ready)
      }
    })
    await Promise.all(cellsReady)
    console.log("Loaded Notebook", this.nodey)
    console.log("TO JSON", this.toJSON())
    this.focusCell(this.notebook.activeCell)
    this.listen()
    this._ready.resolve(undefined);
  }


  toJSON() : {'runs': any[], 'cells': any[]}
  {
    var runList = <any>[] //TODO
    var cells = this.nodey.map( (item : Nodey) => {
      if(item)
        return item.toJSON()
      return []
    })
    return {'runs': runList, 'cells': cells}
  }


  focusCell(cell : Cell) : void
  {
    if(cell instanceof CodeCell)
      this.cells.get(cell).focus()
    if(this.activeCell && this.activeCell instanceof CodeCell)
      this.cells.get(this.activeCell).blur()
    this.activeCell = cell
  }


  private listen()
  {
    this.notebook.activeCellChanged.connect((sender: any, cell: Cell) => {
      this.focusCell(cell)
    })
  }

  private _ready = new PromiseDelegate<void>();
}
