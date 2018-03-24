// Loading an image

var sourceImg = "../images/test.png"

var rgbString = function (rgba) {
	return "rgb(" + parseInt(rgba[0]) + ", " + parseInt(rgba[1]) + ", " + parseInt(rgba[2]) + ")"
}

var showLoading = function () {
	$("#loading").show();
}

var hideLoading = function () {
	$("#loading").hide();
}


// origin image struct
var origin = {
	img: new Image(),
	pixels: null,
	palette: null,
	clusters: null,

	// draw image in the canvas. parameters are the offset
	drawImage: function (x = 0, y = 0) {
		var maxWidth = $("#origin").width();
		var maxHeight = $("#origin").height();

		var ratio = Math.min(maxWidth / this.img.width,
			maxHeight / this.img.height);
		this.context.drawImage(this.img, x, y,
			this.img.width * ratio, this.img.height * ratio);
	},

	getImageData: function (x = 0, y = 0) {
		flatData = this.context.getImageData(x, y, this.canvas.width(), this.canvas.height());

		data = []
		for (var i = 0; i < flatData.data.length; i += 4) {
			pixel = []
			pixel.push(flatData.data[i]);
			pixel.push(flatData.data[i + 1]);
			pixel.push(flatData.data[i + 2]);
			pixel.push(flatData.data[i + 3]);

			data.push(pixel);
		}

		return data;

	},

	getPalette: function () {
		if (!this.pixels)
			return;

		return clusterfck.kmeans(this.pixels, 5);
	},

	showPalette: function () {
		palette = this.palette;

		$("#originColor1").css({
			backgroundColor: rgbString(palette[0])
		});//.addClass("jscolor {valueElement:null,value:'" + rgbString(palette[0]) + "'");


		$("#originColor2").css({
			backgroundColor: rgbString(palette[1])
		});

		$("#originColor3").css({
			backgroundColor: rgbString(palette[2])
		});

		$("#originColor4").css({
			backgroundColor: rgbString(palette[3])
		});

		$("#originColor5").css({
			backgroundColor: rgbString(palette[4])
		});
	},

	recolor: function () {
		return this.pixels
	},

	flattenPixels: function (pixels) {
		data = []
		for (var i = 0; i < pixels.length; i++) {
			pixel = pixels[i]
			data.push(pixel[0]);
			data.push(pixel[1]);
			data.push(pixel[2]);
			data.push(pixel[3]);
		}

		return data;
	},

	getTransferData: function (pixels, x = 0, y = 0) {
		flatData = this.context.getImageData(x, y, this.canvas.width(), this.canvas.height());

		flatData.data = pixels;

		return flatData;
	}
}

// origin image struct
var output = {
	img: new Image(),
	pixels: null,
	palette: null,
	clusters: null,

	// draw image in the canvas. parameters are the offset
	drawImage: function (x = 0, y = 0) {
		var maxWidth = $("#output").width();
		var maxHeight = $("#output").height();

		var ratio = Math.min(maxWidth / this.img.width,
			maxHeight / this.img.height);
		this.context.drawImage(this.img, x, y,
			this.img.width * ratio, this.img.height * ratio);
	},

	getImageData: function (x = 0, y = 0) {
		flatData = this.context.getImageData(x, y, this.canvas.width(), this.canvas.height());

		data = []
		for (var i = 0; i < flatData.data.length; i += 4) {
			pixel = []
			pixel.push(flatData.data[i]);
			pixel.push(flatData.data[i + 1]);
			pixel.push(flatData.data[i + 2]);
			pixel.push(flatData.data[i + 3]);

			data.push(pixel);
		}

		return data;

	},

	putImageData: function (imgData, x = 0, y = 0) {
		this.context.putImageData(imgData, x, y);
	},

	getPalette: function () {
		if (!this.pixels)
			return;

		return clusterfck.kmeans(this.pixels, 5);
	},
}

$(document).ready(function () {

	origin.canvas = $("#origin");
	output.canvas = $("#output");
	origin.context = origin.canvas[0].getContext('2d');
	output.context = output.canvas[0].getContext('2d');

	make_base();

	function make_base() {

		origin.img.onload = function () {
			// draw image in canvas
			origin.drawImage();

			$("#calc").mousedown(showLoading).mouseup(function () {

				// get image array
				origin.pixels = origin.getImageData();
				kmeansResult = origin.getPalette();
				origin.clusters = kmeansResult.clusters;
				origin.palette = kmeansResult.centroids;
				origin.showPalette();

				hideLoading();
			});

			$("#transfer").mousedown(showLoading).mouseup(function () {
				var recolorPixels = origin.recolor();
				var flatPixels = origin.flattenPixels(recolorPixels);

				var imgData = origin.getTransferData(flatPixels);

				output.putImageData(imgData);


				hideLoading();
			});
		}

		origin.img.src = sourceImg;
	}
});