import java.awt.Toolkit;
import java.awt.datatransfer.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.lang.IllegalStateException;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import java.util.Base64;

public class ClipboardTools
{
	public static void main(String args[]) throws IOException, InterruptedException
	{
		if (args.length>0)
		{
			Clipboard clipboard = Toolkit.getDefaultToolkit().getSystemClipboard();
			switch (args[0])
			{
				case "copy":
					boolean foundImage = true;
					BufferedImage image = null;
					try
					{
						image = (BufferedImage) clipboard.getData(DataFlavor.imageFlavor);
					}
					catch (IOException | UnsupportedFlavorException | IllegalStateException e)
					{
						foundImage = false;
					}
					if (foundImage != false)
					{
						byte[] bytes = toByteArray(image, "png");
						byte[] encoded = Base64.getEncoder().encode(bytes);
						System.out.print(new String(encoded));
					}
					break;

				case "paste":
					StringSelection selection = new StringSelection(args[1]);
					clipboard.setContents(selection, selection);
					break;
			}
		}

		System.exit(0);
	}

	public static byte[] toByteArray(BufferedImage bi, String format) throws IOException
	{
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		ImageIO.write(bi, format, baos);
		byte[] bytes = baos.toByteArray();
		return bytes;
	}
}