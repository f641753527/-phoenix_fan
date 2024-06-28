import type { ICanvasTableConstructorProps, IColumnProps, IAnyStructure } from './types'
import { POSITION } from './types'
import { drawCellBorder, drawCellText } from './draw'
import { throttle } from './utils'
import { style } from './const'

/**
 * @description canvas-table
*/
export default class CanvasTable {
    /** 容器宽度 */
    private clientWidth: number;
    private canvas: HTMLCanvasElement;
    private canvasCtx: CanvasRenderingContext2D;
    private columns: IColumnProps[];
    private sourceData: IAnyStructure[];
    /** 当前展示数据 */
    private tableData: IAnyStructure[] = [];
    /** canvas 总高度 (header + body) */
    private height: number;
    /** canvas 总宽度 */
    private width: number = 0;
    private headerHight: number;
    private rowHeight: number;

    /** 数据渲染开始位置 */
    /** 纵向滚动条占比 */
    private scrollX: number = 0;
    private scrollY: number = 0;
    private maxScrollY: number = 0;

    private startIndex: number = 0;
    private endIndex: number = 0;

    private scrollBarY: HTMLElement;

    constructor(options: ICanvasTableConstructorProps) {
        const { clientWidth, canvas, table, scrollBarY } = options;
        const { columns, data, headerHight, rowHeight } = table;
        let { height } = table;
        height = Math.min(height as number, data.length * (rowHeight as number))

        this.clientWidth = clientWidth
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext("2d") as CanvasRenderingContext2D;

        this.columns = columns;
        this.sourceData = data;
        this.height = (height as number) + (headerHight as number);
        this.headerHight = (headerHight as number)
        this.rowHeight = rowHeight as number;

        this.scrollBarY = scrollBarY;
        this.init()
    }

    init() {
        this.initScrollBar()
        this.initColumnsWidth();
        this.setCanvasSize();
        // 初始化数据
        this.setDataByPage();
        // 纵向滚动条Y
        this.initEvents();
    }

    initScrollBar() {
        const { sourceData, rowHeight, headerHight, height, } = this
        /** 表格行高度 */
        const bodyHeight = height - headerHight
        const scrollBarYRate = bodyHeight / ((sourceData.length  * rowHeight) || bodyHeight);
        /** 滚动条 内部块高度 */
        const scrollBarYHeight = scrollBarYRate * bodyHeight;

        this.scrollBarY.style.height = scrollBarYHeight + 'px';
        this.maxScrollY = (1 - scrollBarYRate) * (sourceData.length  * rowHeight);
    }
    /** 设置单元格宽度 */
    initColumnsWidth() {
        /** 固定宽度的列宽汇总 */
        let staticWidth = 0;
        /** 伸缩列宽度汇总 */
        let flexWidth = 0;
        /** 固定列列宽列宽(设置了fixed的列宽求和) */
        let fixedWidth = 0;
        let canvasWidth = 0;
        this.columns.forEach(col => {
            staticWidth += col.width || 0;
            flexWidth += col.minWidth && !col.width ? col.minWidth : 0;
        })
        /** 屏幕剩余宽度(可供伸缩列分配的区域 即减去了固定宽度的列之后的剩余空间) */
        const screenLeftWidth = this.clientWidth - staticWidth
        /** 设置列宽度 优先取width 否则取minWidth */
        this.columns.forEach((col, i) => {
            col.width = col.width || Math.max(
                col.minWidth || 0,
                (col.minWidth as number) / (flexWidth || Infinity) * screenLeftWidth
            );
            if (i === this.columns.length - 1 && screenLeftWidth && flexWidth) {
                col.width = this.clientWidth - canvasWidth;
            }
            canvasWidth += col.width;
            if (col.fixed === 'left' || col.fixed === 'right') {
                fixedWidth += col.width;
            }
        })
        this.width = Math.max(
            Math.min(this.clientWidth, canvasWidth),
            /** canvas width 不能小于固定列宽度 */
            fixedWidth + 200
        );
    }
    setCanvasSize() {
        this.canvas.height = this.height;
        this.canvas.width = this.width;
    }
    /** 设置当前可视区展示的数据 */
    setDataByPage() {
        /** 可视区展示的条数 */
        const limit = Math.ceil((this.height - this.headerHight) / this.rowHeight);
        this.startIndex = ~~(this.scrollY / this.rowHeight);
        this.endIndex = Math.min(this.startIndex + limit, this.sourceData.length);
        this.tableData = this.sourceData.slice(this.startIndex, this.endIndex + 1);
        // 清除画布
        this.clearCanvans();
        // 绘制body
        this.drawBody();
         // 绘制表头
         this.drawHeader();
    }
    /** 清除画布 */
    clearCanvans() {
        // 当宽高重新设置时，就会重新绘制
        const { canvas } = this;
        canvas.width = canvas.width;
        canvas.height = canvas.height;
    }
    /** 绘制表头 */
    drawHeader() {
        const { canvasCtx, canvas, headerHight, columns } = this;

        const headerStyle = { ...style, ...style.header };

        canvasCtx.clearRect(0, 0, canvas.width, headerHight);

        /** 背景色 */
        canvasCtx.fillStyle = headerStyle.backgroundColor as string;
        canvasCtx.fillRect(0, 0, this.width, this.headerHight);

        [POSITION.TOP, POSITION.BOTTOM].forEach(position => {
            drawCellBorder({
                ctx: canvasCtx,
                x: 0,
                y: 0,
                width: canvas.width,
                height: headerHight,
                position,
                style: headerStyle,
            })
        });

        let x = 0
        columns.forEach((col, i) => {
            drawCellText({
                ctx: canvasCtx,
                label: col.label,
                x,
                y: 0,
                width: col.width as number,
                height: headerHight,
                style: headerStyle,
            });
            x += col.width as number;
        })
    }
    /** 绘制body */
    drawBody() {
        const { canvasCtx, canvas, height, headerHight, rowHeight, columns, tableData } = this;

        drawCellBorder({
            ctx: canvasCtx,
            x: 0,
            y: 0,
            width: canvas.width,
            height: this.height,
            position: POSITION.BOTTOM,
            style: style,
        })
        drawCellBorder({
            ctx: canvasCtx,
            x: 0,
            y: 0,
            width: canvas.width,
            height: height,
            position: POSITION.LEFT,
            style: style,
        })

        for (let i = 0; i < tableData.length; i++) {
            drawCellBorder({
                ctx: canvasCtx,
                x: 0,
                y: headerHight + rowHeight * i - (this.scrollY % rowHeight),
                width: canvas.width,
                height: rowHeight,
                position: POSITION.BOTTOM,
                style: style,
            })
        }

        let x = 0
        columns.forEach((col, i) => {
            drawCellBorder({
                ctx: canvasCtx,
                x,
                y: 0,
                width: col.width as number,
                height: this.height,
                position: POSITION.RIGHT,
                style: style,
            })
            x += col.width as number;
        })
        tableData.forEach((row, rowIndex) => {
            x = 0;
            columns.forEach(col => {
                drawCellText({
                    ctx: canvasCtx,
                    label: row[col.key],
                    x,
                    y: headerHight + rowHeight * rowIndex - (this.scrollY % rowHeight),
                    width: col.width as number,
                    height: rowHeight,
                    style,
                });
                x += col.width as number;
            })
        })
    }

    initEvents() {
        this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    }
    onWheel = (e: WheelEvent) => {
        const { deltaX, deltaY } = e
        // 判断是横向滚动还是纵向滚动
        let isHScroll = Math.abs(deltaX) > Math.abs(deltaY);
        if (
            !isHScroll &&
            ((deltaY > 0 && this.scrollY < this.maxScrollY) ||
                (deltaY < 0 && this.scrollY > 0)
            )
        ) {
            e.preventDefault();
            const totalHeight = this.sourceData.length  * this.rowHeight;
            let scrollY = this.scrollY + deltaY;
            scrollY = scrollY < 0 ? 0 : (scrollY > this.maxScrollY ? this.maxScrollY : scrollY);
            this.scrollY = scrollY;
            this.scrollBarY.style.top = (this.scrollY / totalHeight) * (this.height - this.headerHight) + 'px';
            // throttle(this.setDataByPage, 200)
            this.setDataByPage();
        }
    }
}