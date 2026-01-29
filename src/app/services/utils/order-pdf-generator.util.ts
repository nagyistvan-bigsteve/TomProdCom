import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { OrderItemsResponse, OrderResponse } from '../../models/models';

@Injectable({
  providedIn: 'root',
})
export class OrderPdfGeneratorUtil {
  async print(
    orderItems: OrderItemsResponse[],
    order: OrderResponse,
    justOffers: boolean,
  ): Promise<void> {
    try {
      const {
        headerElement,
        contentElement,
        footerElement,
        dataContainerElement,
        tableElement,
      } = await this.getPdfElements();

      const {
        headerCanvas,
        contentCanvas,
        footerCanvas,
        dataContainerCanvas,
        tableCanvas,
      } = await this.capturePrintElements(
        headerElement,
        contentElement,
        footerElement,
        dataContainerElement,
        tableElement,
      );

      const {
        pdfWidth,
        pdfHeight,
        margin,
        headerHeightMM,
        footerHeightMM,
        availableHeight,
        contentWidthMM,
        totalPages,
        dataContainerHeightMM,
        tableHeightMM,
      } = this.createPDFDimensions(
        headerCanvas,
        contentCanvas,
        footerCanvas,
        dataContainerCanvas,
        tableCanvas,
      );

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const headerImgData = headerCanvas.toDataURL('image/png');
      const footerImgData = footerCanvas.toDataURL('image/png');

      // Add pages
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (pageNum > 1) {
          pdf.addPage();
        }

        // Add header
        pdf.addImage(headerImgData, 'PNG', 0, 0, pdfWidth, headerHeightMM);

        const rowHeightMM = (tableHeightMM - 2.5) / (orderItems!.length + 2);

        let extraMargin =
          rowHeightMM +
          2.5 -
          (availableHeight - dataContainerHeightMM) / (orderItems!.length + 2);

        if (availableHeight >= tableHeightMM + dataContainerHeightMM) {
          extraMargin = 0;
        }

        // Calculate content position for this page
        const contentYOffset = (pageNum - 1) * availableHeight - extraMargin;
        const sourceY = (contentYOffset * contentCanvas.width) / contentWidthMM;
        const sourceHeight =
          (availableHeight * contentCanvas.width) / contentWidthMM;

        // Create a temporary canvas for this page's content slice
        const pageCanvas = document.createElement('canvas');
        const ctx = pageCanvas.getContext('2d');

        pageCanvas.width = contentCanvas.width;
        pageCanvas.height = Math.min(
          sourceHeight,
          contentCanvas.height - sourceY,
        );

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

          ctx.drawImage(
            contentCanvas,
            0,
            sourceY,
            contentCanvas.width,
            pageCanvas.height,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height,
          );

          const pageContentImg = pageCanvas.toDataURL('image/png');
          const pageContentHeight =
            (pageCanvas.height * contentWidthMM) / pageCanvas.width;

          // Add content for this page
          pdf.addImage(
            pageContentImg,
            'PNG',
            margin,
            headerHeightMM - 7.5,
            contentWidthMM,
            pageContentHeight,
          );
        }

        // Add footer
        const footerY = pdfHeight - footerHeightMM - margin;
        pdf.addImage(
          footerImgData,
          'PNG',
          margin,
          footerY,
          pdfWidth - margin * 2,
          footerHeightMM,
        );

        // Add page number in bottom right corner
        pdf.setFontSize(15);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `${pageNum}/${totalPages}`,
          pdfWidth - margin - 15,
          pdfHeight - margin - 3,
          { align: 'right' },
        );
      }

      // Detect if iOS/Safari
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as any).MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent,
      );

      if (isIOS || isSafari) {
        // For iOS/Safari: Use native share/print
        this.printPDFiOS(pdf, justOffers, order);
      } else {
        // For other browsers: Use iframe method
        this.printPDFStandard(pdf, justOffers, order);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  }

  private printPDFiOS(pdf: jsPDF, justOffers: boolean, order: OrderResponse) {
    // For iOS: Open PDF in new tab (iOS will show native share/print options)
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Open in new window - iOS will handle it natively
    const printWindow = window.open(pdfUrl, '_blank');

    if (!printWindow) {
      // Fallback: download if popup blocked
      const orderType = justOffers ? 'offer' : 'order';
      const filename = `${orderType}_${order?.id}_${new Date().getTime()}.pdf`;
      pdf.save(filename);
    }

    // Cleanup after delay (user should have opened it by then)
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 10000);
  }

  private printPDFStandard(
    pdf: jsPDF,
    justOffers: boolean,
    order: OrderResponse,
  ) {
    // Convert PDF to blob and open print dialog
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Create hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';

    document.body.appendChild(iframe);

    iframe.onload = () => {
      // Give the PDF time to load in the iframe
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          // Clean up after a delay (to allow print dialog to open)
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(pdfUrl);
          }, 120000);
        } catch (error) {
          console.error('Print error:', error);
          // Fallback: download the PDF
          document.body.removeChild(iframe);
          URL.revokeObjectURL(pdfUrl);

          const orderType = justOffers ? 'offer' : 'order';
          const filename = `${orderType}_#${order?.id}.pdf`;
          pdf.save(filename);

          alert('Could not open print dialog. PDF downloaded instead.');
        }
      }, 250);
    };

    iframe.src = pdfUrl;
  }

  private async getPdfElements(): Promise<{
    headerElement: HTMLElement;
    contentElement: HTMLElement;
    footerElement: HTMLElement;
    dataContainerElement: HTMLElement;
    tableElement: HTMLElement;
  }> {
    await this.delay(500);

    const headerElement = document.getElementById('print-header');
    const contentElement = document.getElementById('print-content');
    const footerElement = document.getElementById('print-footer');
    const dataContainerElement = document.querySelector(
      '.data-container',
    ) as HTMLElement;
    const tableElement = document.querySelector(
      '.table-breaked',
    ) as HTMLElement;

    if (
      !headerElement ||
      !contentElement ||
      !footerElement ||
      !dataContainerElement ||
      !tableElement
    ) {
      throw new Error('Required elements not found');
    }

    return {
      headerElement,
      contentElement,
      footerElement,
      dataContainerElement,
      tableElement,
    };
  }

  private async capturePrintElements(
    headerElement: HTMLElement,
    contentElement: HTMLElement,
    footerElement: HTMLElement,
    dataContainerElement: HTMLElement,
    tableElement: HTMLElement,
  ): Promise<{
    headerCanvas: HTMLCanvasElement;
    contentCanvas: HTMLCanvasElement;
    footerCanvas: HTMLCanvasElement;
    dataContainerCanvas: HTMLCanvasElement;
    tableCanvas: HTMLCanvasElement;
  }> {
    const headerCanvas = await html2canvas(headerElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const footerCanvas = await html2canvas(footerElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const contentCanvas = await html2canvas(contentElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const dataContainerCanvas = await html2canvas(dataContainerElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const tableCanvas = await html2canvas(tableElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    return {
      headerCanvas,
      contentCanvas,
      footerCanvas,
      dataContainerCanvas,
      tableCanvas,
    };
  }

  private createPDFDimensions(
    headerCanvas: HTMLCanvasElement,
    contentCanvas: HTMLCanvasElement,
    footerCanvas: HTMLCanvasElement,
    dataContainerCanvas: HTMLCanvasElement,
    tableCanvas: HTMLCanvasElement,
  ): {
    pdfWidth: number;
    pdfHeight: number;
    margin: number;
    headerHeightMM: number;
    footerHeightMM: number;
    availableHeight: number;
    contentWidthMM: number;
    totalPages: number;
    dataContainerHeightMM: number;
    tableHeightMM: number;
  } {
    // A4 dimensions in mm
    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;

    // Calculate header and footer heights in mm
    const headerHeightMM =
      (headerCanvas.height * pdfWidth) / headerCanvas.width;
    const footerHeightMM =
      (footerCanvas.height * pdfWidth) / footerCanvas.width;

    // Available content height per page
    const availableHeight =
      pdfHeight - headerHeightMM - footerHeightMM - margin;

    // Calculate content dimensions
    const contentWidthMM = pdfWidth - margin * 2;
    const contentHeightMM =
      (contentCanvas.height * contentWidthMM) / contentCanvas.width;

    const dataContainerHeightMM =
      (dataContainerCanvas.height * contentWidthMM) / dataContainerCanvas.width;

    const tableHeightMM =
      (tableCanvas.height * contentWidthMM) / tableCanvas.width;

    // Calculate number of pages needed
    const totalPages = Math.ceil(contentHeightMM / availableHeight);

    return {
      pdfWidth,
      pdfHeight,
      margin,
      headerHeightMM,
      footerHeightMM,
      availableHeight,
      contentWidthMM,
      totalPages,
      dataContainerHeightMM,
      tableHeightMM,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
