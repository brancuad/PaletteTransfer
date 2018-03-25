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

	// Plot histogram of bins
	// Return means of each bin in LAB color space
	getKmeansData: function () {
		// Get histogram of all the colors
		// Derived from https://billmill.org/the_histogram.html
		var colorArray = function () {
			arr = [];
			for (var i = 0; i < 16; i++) {
				arr[i] = []
			}
			return arr;
		};

		var rbins = colorArray();
		var gbins = colorArray();
		var bbins = colorArray();

		// Separate pixels into bins for each color channel
		for (var i = 0; i < this.pixels.length; i++) {
			var getBin = function (num) {
				return Math.floor(num / 16);
			}
			pixel = this.pixels[i];
			rbins[getBin(pixel[0])].push(pixel);
			gbins[getBin(pixel[1])].push(pixel);
			bbins[getBin(pixel[2])].push(pixel);
		}

		// Display histograms
		var histCtx = $("#originHist")[0].getContext('2d');
		var histCanvas = $("#originHist");

		var maxBinSize = function (bins) {
			var maxLength = 0;
			for (var i = 0; i < bins.length; i++) {
				var bin = bins[i];

				if (bin.length > maxLength) {
					maxLength = bin.length;
				}
			}

			return maxLength;
		}

		var rmax = maxBinSize(rbins);
		var gmax = maxBinSize(gbins);
		var bmax = maxBinSize(bbins);

		var colorbars = function (max, bins, color, y) {
			histCtx.fillStyle = color;
			jQuery.each(bins, function (i, x) {
				var pct = (bins[i].length / max) * 130;
				histCtx.fillRect(i * (histCanvas.width() / 16), y, 15, -Math.round(pct));
			});
		};

		colorbars(rmax, rbins, "rgb(255,0,0)", this.canvas.height() / 3);
		colorbars(gmax, gbins, "rgb(0,255,0)", 2 * this.canvas.height() / 3);
		colorbars(bmax, bbins, "rgb(0,0,255)", this.canvas.height());

		// Get mean color per bin in lab color space
		var rmeans = colorArray();
		var gmeans = colorArray();
		var bmeans = colorArray();

		var rlabBins = [];
		var blabBins = [];
		var glabBins = [];

		// Convert to lab and average all bins
		for (var i = 0; i < rbins.length; i++) {
			rbin = rbins[i];
			gbin = gbins[i];
			bbin = bbins[i];

			rlabBin = []
			glabBin = []
			blabBin = []

			// Convert rgb pixels to lab
			for (var j = 0; j < rbin.length; j++) {
				var rlab = rgb2lab(rbin[j]);
				rlabBin[j] = rlab;
			}

			// Average rlab values
			lTotal = 0;
			aTotal = 0;
			bTotal = 0;
			for (var j = 0; j < rlabBin.length; j++) {
				var labPixel = rlabBin[j];
				lTotal += labPixel[0];
				aTotal += labPixel[1];
				bTotal += labPixel[2];
			}

			if (rbin.length > 0) {
				rmeans[i].push(lTotal / rlabBin.length);
				rmeans[i].push(aTotal / rlabBin.length);
				rmeans[i].push(bTotal / rlabBin.length);
			}

			// Convert and average green bin
			for (var j = 0; j < gbin.length; j++) {
				var glab = rgb2lab(gbin[j]);
				glabBin[j] = glab;
			}

			lTotal = 0;
			aTotal = 0;
			bTotal = 0;
			for (var j = 0; j < glabBin.length; j++) {
				var labPixel = glabBin[j];
				lTotal += labPixel[0];
				aTotal += labPixel[1];
				bTotal += labPixel[2];
			}

			if (gbin.length > 0) {
				gmeans[i].push(lTotal / glabBin.length);
				gmeans[i].push(aTotal / glabBin.length);
				gmeans[i].push(bTotal / glabBin.length);


			}

			// Convert and average blue bin
			for (var j = 0; j < bbin.length; j++) {
				var blab = rgb2lab(bbin[j]);
				blabBin[j] = blab;
			}

			lTotal = 0;
			aTotal = 0;
			bTotal = 0;
			for (var j = 0; j < blabBin.length; j++) {
				var labPixel = blabBin[j];
				lTotal += labPixel[0];
				aTotal += labPixel[1];
				bTotal += labPixel[2];
			}

			if (bbin.length > 0) {
				bmeans[i].push(lTotal / blabBin.length);
				bmeans[i].push(aTotal / blabBin.length);
				bmeans[i].push(bTotal / blabBin.length);
			}

			rlabBins.push(rlabBin);
			glabBins.push(glabBin);
			blabBins.push(blabBin);

		}

		var removeEmpty = function (meansArray) {
			var arr = [];

			for (var i = 0; i < meansArray.length; i++) {
				if (meansArray[i].length == 0)
					continue;
				arr.push(meansArray[i]);
			}

			return arr;
		}

		// Combine the mean points gathered from all of the bins
		var means = [];

		means = means.concat(removeEmpty(rmeans));
		means = means.concat(removeEmpty(gmeans));
		means = means.concat(removeEmpty(bmeans));

		// Calculate the starting centroids for kmeans
		var centroids = [];
		var usedBins = [];
		while (centroids.length < 5) {
			// Get mean of largest bin
			var labBins = [rlabBins, glabBins, blabBins];
			var max_i; var max_j; var maxSize = 0;
			for (var i = 0; i < labBins.length; i++) {
				for (var j = 0; j < labBins[i].length; j++) {

					var used = false;
					for (var bin in usedBins) {
						if (usedBins[bin][0] == i && usedBins[bin][1] == j) {
							used = true;
							break;
						}
					}

					if (used)
						continue

					if (labBins[i][j].length > maxSize) {
						maxSize = labBins[i][j].length;
						max_i = i;
						max_j = j;
					}
				}
			}

			if (max_i == 0) {
				centroids.push(rmeans[max_j]);
			}
			else if (max_i == 1) {
				centroids.push(gmeans[max_j]);
			}
			else {
				centroids.push(bmeans[max_j]);
			}

			usedBins.push([max_i, max_j]);

			// TODO: Attenuate size of bins
		}
		
		// Add black to centroids to filter out dark colors
		centroids.push([0.0, 0.0, 0.0])

		return {
			points: means,
			centroids: centroids
		};
	},

	getPalette: function () {

		var data = origin.getKmeansData();
		var kmeansPoints = data.points;

		// The 6th cluster will always filter out the darkest cluster (closest to black)
		var kMeansResult = clusterfck.kmeans(kmeansPoints, 6, data.centroids);

		var palette = []
		for (var i = 0; i < kMeansResult.centroids.length; i++) {
			palette.push(lab2rgb(kMeansResult.centroids[i]));
		}

		return {
			clusters: kMeansResult.clusters,
			palette: palette
		};
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
	},
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
				origin.palette = kmeansResult.palette;
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